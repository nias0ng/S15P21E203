package com.hyanghae.backend.community.controller;

import com.hyanghae.backend.community.dto.request.CommentCreateRequest;
import com.hyanghae.backend.community.dto.request.CommentUpdateRequest;
import com.hyanghae.backend.community.dto.response.CommentCreateResponse;
import com.hyanghae.backend.community.dto.response.CommentUpdateResponse;
import com.hyanghae.backend.community.dto.response.CommentsResponse;
import com.hyanghae.backend.community.service.CommentService;
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
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/**
 * 댓글입니다. <b>자유 게시판 글에만</b> 달립니다.
 *
 * <p>후기에는 댓글을 쓰지 않습니다. 와이어프레임 A22a 가 후기 게시판에 좋아요만 두기로 정했습니다.
 *
 * <p>경로가 두 모양입니다. <b>작성과 목록</b>은 어느 글의 댓글인지가 있어야 의미가 생기므로 글
 * 아래에 둡니다({@code /posts/{postId}/comments}). <b>수정과 삭제</b>는 댓글 번호만으로 하나가
 * 정해지므로 글 없이 접근합니다({@code /comments/{commentId}}). 글을 경로에 넣으면 "글 3 의 댓글
 * 7" 같은 틀린 조합을 또 다뤄야 합니다.
 *
 * <p>목록 조회는 로그인이 필요 없고 쓰기 셋은 필요합니다. 다만 목록의 {@code mine} 은 보는
 * 사람에 따라 달라지므로 로그인 여부를 참고합니다.
 */
@Tag(name = "댓글", description = "자유 게시판 글에 달리는 댓글입니다.")
@RestController
@RequestMapping("/api/v1")
public class CommentController {

    private static final int DEFAULT_PAGE_SIZE = 20;

    private final CommentService commentService;

    public CommentController(CommentService commentService) {
        this.commentService = commentService;
    }

    /**
     * 자유 게시판 글에 댓글을 씁니다.
     *
     * <p>없는 글은 404, 내용이 비었거나 500자를 넘으면 400, 로그인하지 않았으면 401 입니다.
     */
    @Operation(summary = "자유 게시판 글에 댓글 작성")
    @ApiResponse(responseCode = "201", description = "작성 성공")
    @ApiResponse(responseCode = "400", description = "내용이 비었거나 500자 초과")
    @ApiResponse(responseCode = "401", description = "로그인 필요")
    @ApiResponse(responseCode = "404", description = "글 없음")
    @PostMapping("/posts/{postId}/comments")
    @ResponseStatus(HttpStatus.CREATED)
    public CommentCreateResponse createPostComment(
            @Parameter(description = "게시글 ID") @PathVariable Long postId,
            @Valid @RequestBody CommentCreateRequest request
    ) {
        return commentService.create(postId, request);
    }

    /**
     * 자유 게시판 글의 댓글 목록입니다. <b>오래된 순</b>입니다.
     *
     * <p>댓글은 대화라서 위에서 아래로 읽히고 새 댓글이 맨 아래에 붙습니다. 페이지 크기는 기본
     * 20, 최대 100 이고 그 범위를 벗어난 값은 잘립니다.
     */
    @Operation(
            summary = "자유 게시판 글의 댓글 목록",
            description = "오래된 순입니다. 로그인 없이 조회할 수 있고, 로그인한 경우 본인 댓글은"
                    + " mine 이 참입니다."
    )
    @ApiResponse(responseCode = "200", description = "조회 성공")
    @ApiResponse(responseCode = "404", description = "글 없음")
    @GetMapping("/posts/{postId}/comments")
    public CommentsResponse getPostComments(
            @Parameter(description = "게시글 ID") @PathVariable Long postId,

            @Parameter(description = "페이지 번호. 0부터 시작합니다.", example = "0")
            @RequestParam(defaultValue = "0") int page,

            @Parameter(description = "페이지 크기. 기본 20개, 최대 100개입니다.", example = "20")
            @RequestParam(defaultValue = "" + DEFAULT_PAGE_SIZE) int size
    ) {
        return commentService.findPage(postId, page, size);
    }

    /**
     * 댓글을 고칩니다. 어느 글의 댓글인지는 묻지 않습니다.
     *
     * <p>남의 댓글은 403, 없는 댓글은 404 입니다.
     */
    @Operation(
            summary = "댓글 수정",
            description = "댓글 번호만으로 하나가 정해지므로 글 번호를 받지 않습니다."
    )
    @ApiResponse(responseCode = "200", description = "수정 성공")
    @ApiResponse(responseCode = "400", description = "내용이 비었거나 500자 초과")
    @ApiResponse(responseCode = "401", description = "로그인 필요")
    @ApiResponse(responseCode = "403", description = "본인 댓글이 아님")
    @ApiResponse(responseCode = "404", description = "댓글 없음")
    @PatchMapping("/comments/{commentId}")
    public CommentUpdateResponse updateComment(
            @Parameter(description = "댓글 ID") @PathVariable Long commentId,
            @Valid @RequestBody CommentUpdateRequest request
    ) {
        return commentService.update(commentId, request);
    }

    /**
     * 댓글을 지웁니다. <b>행이 사라집니다.</b>
     *
     * <p>지운 시각을 남기지 않습니다. 서재(V4)와 후기·게시글의 보류 상태(V5)에서 걷어낸 것과 같은
     * 기준으로, 댓글도 존재하거나 삭제되거나 둘 중 하나입니다.
     *
     * <p>남의 댓글은 403, 없거나 이미 지운 댓글은 404 입니다.
     */
    @Operation(summary = "댓글 삭제", description = "행을 지웁니다. 되돌릴 수 없습니다.")
    @ApiResponse(responseCode = "204", description = "삭제 성공")
    @ApiResponse(responseCode = "401", description = "로그인 필요")
    @ApiResponse(responseCode = "403", description = "본인 댓글이 아님")
    @ApiResponse(responseCode = "404", description = "댓글 없음")
    @DeleteMapping("/comments/{commentId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteComment(
            @Parameter(description = "댓글 ID") @PathVariable Long commentId
    ) {
        commentService.delete(commentId);
    }
}
