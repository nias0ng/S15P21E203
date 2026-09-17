package com.hyanghae.backend.review.controller;

import com.hyanghae.backend.review.dto.request.ReviewCreateRequest;
import com.hyanghae.backend.review.dto.request.ReviewSeasonsRequest;
import com.hyanghae.backend.review.dto.request.ReviewUpdateRequest;
import com.hyanghae.backend.review.dto.response.ReviewBoardResponse;
import com.hyanghae.backend.review.dto.response.ReviewCreateResponse;
import com.hyanghae.backend.review.dto.response.ReviewDetailResponse;
import com.hyanghae.backend.review.dto.response.ReviewLikeResponse;
import com.hyanghae.backend.review.dto.response.ReviewsResponse;
import com.hyanghae.backend.review.dto.response.ReviewSeasonsResponse;
import com.hyanghae.backend.review.dto.response.ReviewUpdateResponse;
import com.hyanghae.backend.review.repository.ReviewSort;
import com.hyanghae.backend.review.service.ReviewService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.enums.ParameterIn;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@Tag(name = "향수 후기", description = "향수 후기와 선택 계절을 관리합니다.")
@RestController
@RequestMapping("/api/v1")
public class ReviewController {

    private static final int DEFAULT_PAGE_SIZE = 10;

    private final ReviewService reviewService;

    public ReviewController(ReviewService reviewService) {
        this.reviewService = reviewService;
    }

    @Operation(summary = "향수 후기 작성")
    @ApiResponse(responseCode = "201", description = "작성 성공")
    @ApiResponse(responseCode = "400", description = "올바르지 않은 요청")
    @ApiResponse(responseCode = "401", description = "로그인 필요")
    @ApiResponse(responseCode = "404", description = "향수 또는 계절 없음")
    @ApiResponse(responseCode = "409", description = "이미 작성한 후기")
    @PostMapping("/perfumes/{perfumeId}/reviews")
    @ResponseStatus(HttpStatus.CREATED)
    public ReviewCreateResponse createReview(
            @Parameter(
                    name = "perfumeId",
                    description = "향수 ID",
                    in = ParameterIn.PATH,
                    required = true,
                    schema = @Schema(type = "integer", format = "int64")
            )
            @PathVariable Long perfumeId,
            @Valid @RequestBody ReviewCreateRequest request
    ) {
        return reviewService.create(perfumeId, request);
    }

    @Operation(
            summary = "향수 후기 목록 조회",
            description = "향수 후기를 최신 작성 순으로 조회합니다. 로그인한 경우 본인 후기를 표시합니다."
    )
    @ApiResponse(responseCode = "200", description = "조회 성공")
    @ApiResponse(responseCode = "404", description = "향수 없음")
    @GetMapping("/perfumes/{perfumeId}/reviews")
    public ReviewsResponse getReviews(
            @Parameter(
                    name = "perfumeId",
                    description = "향수 ID",
                    in = ParameterIn.PATH,
                    required = true,
                    schema = @Schema(type = "integer", format = "int64")
            )
            @PathVariable Long perfumeId,
            @Parameter(description = "페이지 번호. 0부터 시작합니다.", example = "0")
            @RequestParam(defaultValue = "0") int page,
            @Parameter(description = "페이지 크기. 기본 10개, 최대 100개입니다.", example = "10")
            @RequestParam(defaultValue = "" + DEFAULT_PAGE_SIZE) int size
    ) {
        return reviewService.findByPerfume(perfumeId, page, size);
    }

    /**
     * 후기를 고칩니다. <b>보낸 항목만 바뀌고, 전부 저장되거나 전부 취소됩니다.</b>
     *
     * <p>제목 · 내용 · 계절을 한 요청으로 받습니다. 계절을 따로 받던 시절에는 화면이 두 번을
     * 불러야 했고, 앞이 저장된 뒤 뒤가 실패하면 서버에는 제목이 바뀌어 있는데 화면은
     * "아무것도 저장 안 됨"으로 보였습니다.
     *
     * <p>응답은 보낸 항목이 아니라 <b>고쳐진 결과 전체</b>입니다. 화면이 이 응답만으로 캐시를
     * 갱신할 수 있습니다.
     */
    @Operation(
            summary = "향수 후기 수정",
            description = "제목 · 내용 · 계절을 한 요청으로 고칩니다. 보낸 항목만 바뀌고,"
                    + " 하나라도 실패하면 전부 취소됩니다. 응답에는 고쳐진 결과 전체가 담깁니다."
    )
    @ApiResponse(responseCode = "200", description = "수정 성공")
    @ApiResponse(responseCode = "400",
            description = "고칠 항목이 없거나, 제목·내용이 비었거나, 계절 코드가 올바르지 않음")
    @ApiResponse(responseCode = "401", description = "로그인 필요")
    @ApiResponse(responseCode = "404", description = "본인 후기 없음 또는 계절 없음")
    @PatchMapping("/reviews/{reviewId}")
    public ReviewUpdateResponse updateReview(
            @Parameter(
                    name = "reviewId",
                    description = "후기 ID",
                    in = ParameterIn.PATH,
                    required = true,
                    schema = @Schema(type = "integer", format = "int64")
            )
            @PathVariable Long reviewId,
            @Valid @RequestBody ReviewUpdateRequest request
    ) {
        return reviewService.update(reviewId, request);
    }

    @Operation(summary = "향수 후기 삭제")
    @ApiResponse(responseCode = "204", description = "삭제 성공")
    @ApiResponse(responseCode = "401", description = "로그인 필요")
    @ApiResponse(responseCode = "404", description = "본인 후기 없음")
    @DeleteMapping("/reviews/{reviewId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteReview(
            @Parameter(
                    name = "reviewId",
                    description = "후기 ID",
                    in = ParameterIn.PATH,
                    required = true,
                    schema = @Schema(type = "integer", format = "int64")
            )
            @PathVariable Long reviewId
    ) {
        reviewService.delete(reviewId);
    }

    /**
     * 계절만 바꿉니다.
     *
     * <p>제목·내용과 함께 고칠 때는 {@code PATCH /reviews/{reviewId}} 로 한 번에 보내십시오.
     * 그쪽은 한 트랜잭션이라 일부만 저장되는 일이 없습니다. 이 엔드포인트는 계절만 바꾸는
     * 화면을 위해 남겨 둡니다.
     */
    @Operation(
            summary = "후기 계절 선택 수정",
            description = "본인 후기에 연결된 계절 선택을 전체 교체합니다. 제목·내용과 함께"
                    + " 고칠 때는 PATCH /reviews/{reviewId} 로 한 번에 보내십시오. 그쪽은 한"
                    + " 트랜잭션이라 일부만 저장되는 일이 없습니다."
    )
    @ApiResponse(responseCode = "200", description = "수정 성공")
    @ApiResponse(responseCode = "400", description = "빈 목록, 중복 등 올바르지 않은 요청")
    @ApiResponse(responseCode = "401", description = "로그인 필요")
    @ApiResponse(responseCode = "404", description = "본인 후기 또는 계절 없음")
    @PutMapping("/reviews/{reviewId}/seasons")
    public ReviewSeasonsResponse replaceReviewSeasons(
            @Parameter(
                    name = "reviewId",
                    description = "후기 ID",
                    in = ParameterIn.PATH,
                    required = true,
                    schema = @Schema(type = "integer", format = "int64")
            )
            @PathVariable Long reviewId,
            @Valid @RequestBody ReviewSeasonsRequest request
    ) {
        return reviewService.replaceSeasons(reviewId, request.seasonCodes());
    }

    /**
     * 후기 게시판 목록입니다. 향수를 가리지 않고 전체를 봅니다.
     *
     * <p>향수 상세의 후기 목록({@code /perfumes/{perfumeId}/reviews})과 다릅니다. 거기서는 향수
     * 하나의 후기만 보고, 여기서는 여러 향수의 후기가 섞여 나옵니다. 그래서 줄마다 향수가 함께
     * 실립니다.
     *
     * <p>분류 필터가 없습니다. 후기는 전부 같은 종류입니다(와이어프레임 A22a).
     */
    @Operation(
            summary = "후기 게시판 목록",
            description = "향수를 가리지 않은 전체 후기입니다. 기본은 최신순이고 로그인 없이"
                    + " 조회할 수 있습니다. 로그인한 경우 내가 좋아요를 누른 후기는 liked 가"
                    + " 참입니다."
    )
    @ApiResponse(responseCode = "200", description = "조회 성공")
    @ApiResponse(responseCode = "400", description = "정렬 기준이 올바르지 않음")
    @GetMapping("/reviews")
    public ReviewBoardResponse getReviewBoard(
            @Parameter(description = "정렬 기준. RECENT(최신순) · VIEWS(조회 순) · LIKES(좋아요 순)."
                    + " 후기에는 댓글이 없어 댓글 순이 없습니다.")
            @RequestParam(defaultValue = "RECENT") ReviewSort sort,

            @Parameter(description = "페이지 번호. 0부터 시작합니다.", example = "0")
            @RequestParam(defaultValue = "0") int page,

            @Parameter(description = "페이지 크기. 기본 10개, 최대 100개입니다.", example = "10")
            @RequestParam(defaultValue = "" + DEFAULT_PAGE_SIZE) int size
    ) {
        return reviewService.findBoardPage(sort, page, size);
    }

    /**
     * 후기 상세입니다. 로그인하지 않아도 볼 수 있습니다.
     *
     * <p>여는 것이 곧 조회라 조회수가 하나 오릅니다. 응답의 {@code viewCount} 는 이번 조회를
     * 포함한 수입니다.
     */
    @Operation(
            summary = "후기 상세",
            description = "로그인 없이 조회할 수 있습니다. 조회수가 하나 오르고, 응답의 viewCount"
                    + " 는 이번 조회를 포함한 수입니다."
    )
    @ApiResponse(responseCode = "200", description = "조회 성공")
    @ApiResponse(responseCode = "404", description = "후기 없음")
    @GetMapping("/reviews/{reviewId}")
    public ReviewDetailResponse getReview(
            @Parameter(
                    name = "reviewId",
                    description = "후기 ID",
                    in = ParameterIn.PATH,
                    required = true,
                    schema = @Schema(type = "integer", format = "int64")
            )
            @PathVariable Long reviewId
    ) {
        return reviewService.findOne(reviewId);
    }

    /**
     * 좋아요를 누릅니다. <b>여러 번 눌러도 결과가 같습니다.</b>
     *
     * <p>{@code PUT} 인 이유가 있습니다. 토글({@code POST})로 두면 네트워크가 끊겨 화면이 요청을
     * 다시 보낼 때 상태가 뒤집힙니다. 사용자는 한 번 눌렀는데 좋아요가 취소되는 것이죠. 누르기와
     * 취소를 서로 다른 메서드로 나누면 몇 번을 보내도 결과가 하나로 정해집니다.
     */
    @Operation(
            summary = "후기 좋아요",
            description = "여러 번 눌러도 결과가 같습니다. 이미 누른 후기면 상태만 돌려줍니다."
    )
    @ApiResponse(responseCode = "200", description = "좋아요 상태")
    @ApiResponse(responseCode = "401", description = "로그인 필요")
    @ApiResponse(responseCode = "404", description = "후기 없음")
    @PutMapping("/reviews/{reviewId}/like")
    public ReviewLikeResponse likeReview(
            @Parameter(
                    name = "reviewId",
                    description = "후기 ID",
                    in = ParameterIn.PATH,
                    required = true,
                    schema = @Schema(type = "integer", format = "int64")
            )
            @PathVariable Long reviewId
    ) {
        return reviewService.like(reviewId);
    }

    /**
     * 좋아요를 취소합니다. 누르지 않은 후기에 취소해도 오류가 아닙니다.
     *
     * <p>응답 본문이 있어 {@code 204} 가 아니라 {@code 200} 입니다. 화면이 하트와 옆의 숫자를
     * 함께 갱신해야 하는데, 숫자를 안 보내면 화면이 스스로 빼야 하고 그 사이 다른 사람이 누른
     * 것이 반영되지 않습니다.
     */
    @Operation(
            summary = "후기 좋아요 취소",
            description = "누르지 않은 후기에 취소해도 오류가 아닙니다."
    )
    @ApiResponse(responseCode = "200", description = "좋아요 상태")
    @ApiResponse(responseCode = "401", description = "로그인 필요")
    @ApiResponse(responseCode = "404", description = "후기 없음")
    @DeleteMapping("/reviews/{reviewId}/like")
    public ReviewLikeResponse unlikeReview(
            @Parameter(
                    name = "reviewId",
                    description = "후기 ID",
                    in = ParameterIn.PATH,
                    required = true,
                    schema = @Schema(type = "integer", format = "int64")
            )
            @PathVariable Long reviewId
    ) {
        return reviewService.unlike(reviewId);
    }
}
