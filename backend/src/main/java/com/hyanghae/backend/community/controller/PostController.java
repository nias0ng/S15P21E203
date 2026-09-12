package com.hyanghae.backend.community.controller;

import com.hyanghae.backend.community.dto.request.PostCreateRequest;
import com.hyanghae.backend.community.dto.request.PostUpdateRequest;
import com.hyanghae.backend.community.dto.response.PostCreateResponse;
import com.hyanghae.backend.community.dto.response.PostDetailResponse;
import com.hyanghae.backend.community.dto.response.PostUpdateResponse;
import com.hyanghae.backend.community.dto.response.PostsResponse;
import com.hyanghae.backend.community.service.PostService;
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
 * 자유 게시판 글입니다.
 *
 * <p>후기는 향수에 매달리는 다른 자료라 {@code review} 도메인이 담당합니다. 후기 게시판 화면도
 * 후기 쪽 자료를 보여줍니다. 여기 있는 것은 컬렉션 공유·추천·잡담 세 분류의 글뿐입니다.
 *
 * <p>읽기(목록·상세)는 로그인이 필요 없고, 쓰기(작성·수정·삭제)는 필요합니다. 게시판은 누구나 볼
 * 수 있어야 하고, 글은 쓴 사람에게 매달리는 값입니다.
 */
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
     * 이미지는 주소만 받습니다. 파일을 올리는 방법은 아직 정해지지 않았습니다.
     *
     * <p>없거나 내려간 분류·향수는 404, 제목이 50자를 넘거나 내용이 비면 400, 로그인하지 않았으면
     * 401 입니다.
     */
    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public PostCreateResponse createPost(@Valid @RequestBody PostCreateRequest request) {
        return postService.create(request);
    }

    /**
     * 게시글 목록입니다. 최신순입니다.
     *
     * <p>{@code category} 에 분류 코드(COLLECTION · RECOMMEND · CHAT)를 주면 그 분류만, 주지 않으면
     * 전체입니다. 번호가 아니라 코드인 이유는 번호가 자동 증가라 환경마다 다르기 때문입니다. 페이지 크기는 기본 20,
     * 최대 100 이고 그 범위를 벗어난 값은 잘립니다.
     */
    @GetMapping
    public PostsResponse getPosts(
            @RequestParam(required = false) String category,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "" + DEFAULT_PAGE_SIZE) int size
    ) {
        return postService.findPage(category, page, size);
    }

    /**
     * 게시글 상세입니다. 로그인하지 않아도 볼 수 있습니다.
     *
     * <p>작성자가 탈퇴한 글은 {@code nickname} 이 비어 나갑니다. 글은 남고 작성자만 지워집니다.
     */
    @GetMapping("/{postId}")
    public PostDetailResponse getPost(@PathVariable Long postId) {
        return postService.findOne(postId);
    }

    /**
     * 글을 고칩니다. <b>보낸 항목만 바뀌고 나머지는 그대로입니다.</b>
     *
     * <p>향수와 이미지는 보낸 목록으로 통째로 바뀝니다. 빈 배열을 보내면 연결이 모두 지워집니다.
     *
     * <p>남의 글은 403, 없는 글은 404 입니다.
     */
    @PatchMapping("/{postId}")
    public PostUpdateResponse updatePost(
            @PathVariable Long postId,
            @Valid @RequestBody PostUpdateRequest request
    ) {
        return postService.update(postId, request);
    }

    /**
     * 글을 지웁니다. 이미지·향수 연결과 댓글이 함께 지워집니다.
     *
     * <p>남의 글은 403, 없는 글은 404 입니다.
     */
    @DeleteMapping("/{postId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deletePost(@PathVariable Long postId) {
        postService.delete(postId);
    }
}
