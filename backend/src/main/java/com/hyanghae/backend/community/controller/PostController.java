package com.hyanghae.backend.community.controller;

import com.hyanghae.backend.community.dto.request.PostCreateRequest;
import com.hyanghae.backend.community.dto.request.PostUpdateRequest;
import com.hyanghae.backend.community.dto.response.PostCreateResponse;
import com.hyanghae.backend.community.dto.response.PostDetailResponse;
import com.hyanghae.backend.community.dto.response.PostLikeResponse;
import com.hyanghae.backend.community.dto.response.PostUpdateResponse;
import com.hyanghae.backend.community.dto.response.PostsResponse;
import com.hyanghae.backend.community.repository.PostSort;
import com.hyanghae.backend.community.service.PostService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
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

/**
 * 자유 게시판 글입니다.
 *
 * <p>후기는 향수에 매달리는 다른 자료라 {@code review} 도메인이 담당합니다. 후기 게시판 화면도
 * 후기 쪽 자료를 보여줍니다. 여기 있는 것은 컬렉션 공유·추천·잡담 세 분류의 글뿐입니다.
 *
 * <p>읽기(목록·상세)는 로그인이 필요 없고, 쓰기(작성·수정·삭제·좋아요)는 필요합니다. 게시판은
 * 누구나 볼 수 있어야 하고, 글과 좋아요는 쓴 사람에게 매달리는 값입니다.
 */
@Tag(name = "자유 게시판", description = "자유 게시판 글을 쓰고 읽고 고치고 지웁니다.")
@RestController
@RequestMapping("/api/v1/posts")
public class PostController {

    private static final int DEFAULT_PAGE_SIZE = 20;

    private final PostService postService;

    public PostController(PostService postService) {
        this.postService = postService;
    }

    /**
     * 글을 씁니다.
     *
     * <p>분류는 필수입니다. 향수와 이미지는 없어도 되고, 보낸 순서를 그대로 보여줄 순서로 씁니다.
     * 이미지는 주소만 받습니다. 파일은 {@link PostImageController} 로 먼저 올립니다.
     *
     * <p><b>컬렉션을 붙이면 그 컬렉션의 향수가 글의 향수가 됩니다.</b> 이름과 향수를 글에
     * 복사해 두므로, 나중에 컬렉션을 고치거나 지워도 글은 그대로입니다. 향수를 따로 보내면
     * 출처가 둘이 되어 400 입니다.
     *
     * <p>없거나 내려간 분류·향수는 404, 제목이 50자를 넘거나 내용이 비면 400, 로그인하지 않았으면
     * 401 입니다.
     */
    @Operation(
            summary = "자유 게시판 글 작성",
            description = "컬렉션을 붙이면 그 컬렉션의 이름과 향수를 글에 복사합니다. 이후"
                    + " 컬렉션이 바뀌어도 글은 그대로입니다."
    )
    @ApiResponse(responseCode = "201", description = "작성 성공")
    @ApiResponse(responseCode = "400",
            description = "제목·내용이 비었거나, 향수가 중복되거나, 컬렉션과 향수를 함께 보냄")
    @ApiResponse(responseCode = "401", description = "로그인 필요")
    @ApiResponse(responseCode = "404", description = "분류 또는 향수 없음")
    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public PostCreateResponse createPost(@Valid @RequestBody PostCreateRequest request) {
        return postService.create(request);
    }

    /**
     * 게시글 목록입니다. 기본은 최신순이고 조회·좋아요·댓글 많은 순으로도 볼 수 있습니다.
     *
     * <p>{@code category} 에 분류 코드(COLLECTION · RECOMMEND · CHAT)를 주면 그 분류만, 주지 않으면
     * 전체입니다. 번호가 아니라 코드인 이유는 번호가 자동 증가라 환경마다 다르기 때문입니다. 페이지
     * 크기는 기본 20, 최대 100 이고 그 범위를 벗어난 값은 잘립니다.
     *
     * <p>정렬은 넷입니다. 후기 게시판에는 댓글 순이 없어 셋뿐입니다.
     */
    @Operation(
            summary = "자유 게시판 글 목록",
            description = "기본은 최신순입니다. 로그인 없이 조회할 수 있고, 로그인한 경우 내가"
                    + " 좋아요를 누른 글은 liked 가 참입니다."
    )
    @ApiResponse(responseCode = "200", description = "조회 성공")
    @ApiResponse(responseCode = "400", description = "정렬 기준이 올바르지 않음")
    @GetMapping
    public PostsResponse getPosts(
            @Parameter(description = "분류 코드. 주지 않으면 전체", example = "CHAT")
            @RequestParam(required = false) String category,

            @Parameter(description = "정렬 기준. RECENT(최신순) · VIEWS(조회 순) · LIKES(좋아요 순)"
                    + " · COMMENTS(댓글 많은 순)")
            @RequestParam(defaultValue = "RECENT") PostSort sort,

            @Parameter(description = "페이지 번호. 0부터 시작합니다.", example = "0")
            @RequestParam(defaultValue = "0") int page,

            @Parameter(description = "페이지 크기. 기본 20개, 최대 100개입니다.", example = "20")
            @RequestParam(defaultValue = "" + DEFAULT_PAGE_SIZE) int size
    ) {
        return postService.findPage(category, sort, page, size);
    }

    /**
     * 게시글 상세입니다. 로그인하지 않아도 볼 수 있습니다.
     *
     * <p>작성자가 탈퇴한 글은 {@code nickname} 이 비어 나갑니다. 글은 남고 작성자만 지워집니다.
     */
    @Operation(
            summary = "자유 게시판 글 상세",
            description = "로그인 없이 조회할 수 있습니다. 로그인한 경우 본인 글이면 mine 이 참입니다."
    )
    @ApiResponse(responseCode = "200", description = "조회 성공")
    @ApiResponse(responseCode = "404", description = "글 없음")
    @GetMapping("/{postId}")
    public PostDetailResponse getPost(
            @Parameter(description = "게시글 ID") @PathVariable Long postId
    ) {
        return postService.findOne(postId);
    }

    /**
     * 글을 고칩니다. <b>보낸 항목만 바뀌고 나머지는 그대로입니다.</b>
     *
     * <p>향수와 이미지는 보낸 목록으로 통째로 바뀝니다. 빈 배열을 보내면 연결이 모두 지워집니다.
     *
     * <p><b>컬렉션은 번호를 보낼 때만 다시 읽습니다.</b> 보내지 않으면 글을 쓸 때 박제한 이름과
     * 향수가 그대로입니다. 컬렉션이 붙어 있는 글에 향수를 따로 보내면 400 입니다.
     *
     * <p>남의 글은 403, 없는 글은 404 입니다.
     */
    @Operation(
            summary = "자유 게시판 글 수정",
            description = "보낸 항목만 바뀝니다. 컬렉션은 번호를 보낼 때만 다시 읽고, 보내지"
                    + " 않으면 글을 쓸 때 박제한 이름과 향수가 그대로입니다."
    )
    @ApiResponse(responseCode = "200", description = "수정 성공")
    @ApiResponse(responseCode = "400",
            description = "고칠 항목이 없거나, 분류·제목·내용을 비우거나, 컬렉션이 붙은 글에"
                    + " 향수를 따로 보냄")
    @ApiResponse(responseCode = "401", description = "로그인 필요")
    @ApiResponse(responseCode = "403", description = "본인 글이 아님")
    @ApiResponse(responseCode = "404", description = "글 또는 분류·향수 없음")
    @PatchMapping("/{postId}")
    public PostUpdateResponse updatePost(
            @Parameter(description = "게시글 ID") @PathVariable Long postId,
            @Valid @RequestBody PostUpdateRequest request
    ) {
        return postService.update(postId, request);
    }

    /**
     * 좋아요를 누릅니다. <b>여러 번 눌러도 결과가 같습니다.</b>
     *
     * <p>{@code PUT} 인 이유가 있습니다. 토글({@code POST})로 두면 네트워크가 끊겨 화면이 요청을
     * 다시 보낼 때 상태가 뒤집힙니다. 사용자는 한 번 눌렀는데 좋아요가 취소되는 것이죠. 누르기와
     * 취소를 서로 다른 메서드로 나누면 몇 번을 보내도 결과가 하나로 정해집니다.
     *
     * <p>없는 글은 404, 로그인하지 않았으면 401 입니다.
     */
    @Operation(
            summary = "자유 게시판 글 좋아요",
            description = "여러 번 눌러도 결과가 같습니다. 이미 누른 글이면 상태만 돌려줍니다."
    )
    @ApiResponse(responseCode = "200", description = "좋아요 상태")
    @ApiResponse(responseCode = "401", description = "로그인 필요")
    @ApiResponse(responseCode = "404", description = "글 없음")
    @PutMapping("/{postId}/like")
    public PostLikeResponse likePost(
            @Parameter(description = "게시글 ID") @PathVariable Long postId
    ) {
        return postService.like(postId);
    }

    /**
     * 좋아요를 취소합니다. 누르지 않은 글에 취소해도 오류가 아닙니다.
     *
     * <p>응답 본문이 있어 {@code 204} 가 아니라 {@code 200} 입니다. 화면이 하트와 옆의 숫자를
     * 함께 갱신해야 하는데, 숫자를 안 보내면 화면이 스스로 빼야 하고 그 사이 다른 사람이 누른
     * 것이 반영되지 않습니다.
     */
    @Operation(
            summary = "자유 게시판 글 좋아요 취소",
            description = "누르지 않은 글에 취소해도 오류가 아닙니다."
    )
    @ApiResponse(responseCode = "200", description = "좋아요 상태")
    @ApiResponse(responseCode = "401", description = "로그인 필요")
    @ApiResponse(responseCode = "404", description = "글 없음")
    @DeleteMapping("/{postId}/like")
    public PostLikeResponse unlikePost(
            @Parameter(description = "게시글 ID") @PathVariable Long postId
    ) {
        return postService.unlike(postId);
    }

    /**
     * 글을 지웁니다. 이미지·향수 연결과 댓글, 좋아요가 함께 지워집니다.
     *
     * <p>남의 글은 403, 없는 글은 404 입니다.
     */
    @Operation(summary = "자유 게시판 글 삭제")
    @ApiResponse(responseCode = "204", description = "삭제 성공")
    @ApiResponse(responseCode = "401", description = "로그인 필요")
    @ApiResponse(responseCode = "403", description = "본인 글이 아님")
    @ApiResponse(responseCode = "404", description = "글 없음")
    @DeleteMapping("/{postId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deletePost(
            @Parameter(description = "게시글 ID") @PathVariable Long postId
    ) {
        postService.delete(postId);
    }
}
