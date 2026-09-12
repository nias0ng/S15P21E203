package com.hyanghae.backend.review.controller;

import com.hyanghae.backend.review.dto.request.ReviewCreateRequest;
import com.hyanghae.backend.review.dto.request.ReviewSeasonsRequest;
import com.hyanghae.backend.review.dto.request.ReviewUpdateRequest;
import com.hyanghae.backend.review.dto.response.ReviewCreateResponse;
import com.hyanghae.backend.review.dto.response.ReviewsResponse;
import com.hyanghae.backend.review.dto.response.ReviewSeasonsResponse;
import com.hyanghae.backend.review.dto.response.ReviewUpdateResponse;
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

    @Operation(summary = "향수 후기 수정")
    @ApiResponse(responseCode = "200", description = "수정 성공")
    @ApiResponse(responseCode = "400", description = "올바르지 않은 요청")
    @ApiResponse(responseCode = "401", description = "로그인 필요")
    @ApiResponse(responseCode = "404", description = "본인 후기 없음")
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

    @Operation(
            summary = "후기 계절 선택 수정",
            description = "본인 후기에 연결된 계절 선택을 전체 교체합니다."
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
        return reviewService.replaceSeasons(reviewId, request.seasonIds());
    }
}
