package com.hyanghae.backend.community.service;

import com.hyanghae.backend.community.dto.request.PostCreateRequest;
import com.hyanghae.backend.community.dto.request.PostUpdateRequest;
import com.hyanghae.backend.community.dto.response.PostCreateResponse;
import com.hyanghae.backend.community.dto.response.PostDetailResponse;
import com.hyanghae.backend.community.dto.response.PostSummaryResponse;
import com.hyanghae.backend.community.dto.response.PostUpdateResponse;
import com.hyanghae.backend.community.dto.response.PostsResponse;
import com.hyanghae.backend.community.exception.CommunityErrorCode;
import com.hyanghae.backend.community.repository.CreatedPost;
import com.hyanghae.backend.community.repository.PostRepository;
import com.hyanghae.backend.community.repository.PostRow;
import com.hyanghae.backend.global.exception.BusinessException;
import com.hyanghae.backend.global.security.CurrentUser;
import java.time.OffsetDateTime;
import java.util.HashSet;
import java.util.List;
import java.util.Objects;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 게시글을 쓰고 고치고 지우고 읽습니다.
 *
 * <p>읽기는 로그인이 필요 없습니다. 게시판은 누구나 볼 수 있어야 하고, 목록과 상세에 사용자별로
 * 달라지는 값이 없습니다. 쓰기 셋은 로그인이 필요합니다.
 *
 * <p>이미지는 주소만 받습니다. 파일을 올리는 방법이 정해지면 그 API 가 주소를 돌려주고, 화면이
 * 그것을 여기로 보내면 됩니다. 이 서비스는 바뀔 일이 없습니다.
 */
@Service
public class PostService {

    private static final int MAX_PAGE_SIZE = 100;

    private final PostRepository postRepository;
    private final CurrentUser currentUser;

    public PostService(PostRepository postRepository, CurrentUser currentUser) {
        this.postRepository = postRepository;
        this.currentUser = currentUser;
    }

    /**
     * 글을 씁니다. 분류는 활성인 것이어야 하고, 거는 향수도 활성이어야 합니다.
     *
     * <p>향수와 이미지는 보낸 순서를 그대로 보여줄 순서로 씁니다.
     */
    @Transactional
    public PostCreateResponse create(PostCreateRequest request) {
        Long userId = currentUserId();
        requireActiveCategory(request.categoryId());

        List<Long> perfumeIds = distinctPerfumeIds(request.perfumeIds());
        requireActivePerfumes(perfumeIds);
        List<String> imageUrls = orEmpty(request.imageUrls());

        CreatedPost created = postRepository.insert(
                userId, request.categoryId(), request.title().strip(), request.content().strip());
        postRepository.replacePerfumes(created.postId(), perfumeIds);
        postRepository.replaceImages(created.postId(), imageUrls);

        return new PostCreateResponse(created.postId(), created.createdAt());
    }

    /**
     * 글을 고칩니다. 보낸 항목만 바뀌고 나머지는 그대로입니다.
     *
     * <p>향수와 이미지는 보낸 목록으로 통째로 바뀝니다. 빈 배열을 보내면 연결이 모두 지워집니다.
     */
    @Transactional
    public PostUpdateResponse update(Long postId, PostUpdateRequest request) {
        PostRow post = requireMyPost(postId);

        Long categoryId = request.isCategoryPresent()
                ? requireActiveCategory(request.getCategoryId())
                : post.category().categoryId();
        String title = request.isTitlePresent() ? request.getTitle().strip() : post.title();
        String content = request.isContentPresent() ? request.getContent().strip() : post.content();

        OffsetDateTime updatedAt = postRepository.update(postId, categoryId, title, content);

        if (request.isPerfumesPresent()) {
            List<Long> perfumeIds = distinctPerfumeIds(request.getPerfumeIds());
            requireActivePerfumes(perfumeIds);
            postRepository.replacePerfumes(postId, perfumeIds);
        }
        if (request.isImagesPresent()) {
            postRepository.replaceImages(postId, request.getImageUrls());
        }

        return new PostUpdateResponse(postId, updatedAt);
    }

    /**
     * 글을 지웁니다. 이미지와 향수 연결은 외래키가 함께 지웁니다.
     *
     * <p>댓글도 함께 지워집니다({@code comments.post_id} 가 {@code ON DELETE CASCADE} 입니다).
     */
    @Transactional
    public void delete(Long postId) {
        postRepository.delete(requireMyPost(postId).postId());
    }

    /**
     * 게시글 목록입니다. 최신순이고 분류로 거를 수 있습니다.
     *
     * <p>분류를 주지 않으면 전체입니다. 페이지 크기는 1~100 으로 자릅니다.
     */
    @Transactional(readOnly = true)
    public PostsResponse findPage(Long categoryId, int page, int size) {
        int pageNumber = Math.max(page, 0);
        int pageSize = Math.clamp(size, 1, MAX_PAGE_SIZE);

        List<PostSummaryResponse> posts =
                postRepository.findPage(categoryId, pageSize, (long) pageNumber * pageSize);

        return new PostsResponse(
                posts, pageNumber, pageSize, postRepository.count(categoryId));
    }

    /** 게시글 상세입니다. 없는 글은 404 입니다. */
    @Transactional(readOnly = true)
    public PostDetailResponse findOne(Long postId) {
        PostRow post = requirePost(postId);

        return new PostDetailResponse(
                post.postId(),
                post.category(),
                post.nickname(),
                post.title(),
                post.content(),
                postRepository.findImageUrls(postId),
                postRepository.findPerfumes(postId),
                post.createdAt(),
                post.updatedAt()
        );
    }

    private PostRow requirePost(Long postId) {
        return postRepository.findById(postId)
                .orElseThrow(() ->
                        new BusinessException(CommunityErrorCode.COMMUNITY_POST_NOT_FOUND));
    }

    /**
     * 내가 쓴 글이어야 고치거나 지울 수 있습니다.
     *
     * <p>남의 글은 404 가 아니라 403 입니다. 게시글은 누구나 볼 수 있어 존재를 숨길 이유가 없고,
     * 404 로 답하면 "글이 지워졌나" 와 "내 글이 아닌가" 를 화면이 구분하지 못합니다.
     *
     * <p>작성자가 탈퇴한 글은 아무도 고칠 수 없습니다. 글은 남지만 주인이 없어집니다.
     */
    private PostRow requireMyPost(Long postId) {
        PostRow post = requirePost(postId);
        if (!Objects.equals(post.authorId(), currentUserId())) {
            throw new BusinessException(CommunityErrorCode.COMMUNITY_POST_NOT_OWNED);
        }
        return post;
    }

    private Long requireActiveCategory(Long categoryId) {
        return postRepository.findActiveCategory(categoryId)
                .orElseThrow(() ->
                        new BusinessException(CommunityErrorCode.COMMUNITY_CATEGORY_NOT_FOUND))
                .categoryId();
    }

    /**
     * 같은 향수를 두 번 걸 수 없습니다.
     *
     * <p>{@code post_perfumes} 의 기본키가 (글, 향수)라 어차피 두 번은 들어가지 않습니다. 조용히
     * 하나로 합치지 않고 400 으로 돌려주는 이유는, 화면이 중복을 보냈다는 것은 목록을 잘못 만들고
     * 있다는 뜻이기 때문입니다.
     */
    private List<Long> distinctPerfumeIds(List<Long> perfumeIds) {
        List<Long> ids = orEmpty(perfumeIds);
        if (new HashSet<>(ids).size() != ids.size()) {
            throw new BusinessException(CommunityErrorCode.COMMUNITY_POST_INVALID);
        }
        return ids;
    }

    private void requireActivePerfumes(List<Long> perfumeIds) {
        if (postRepository.countActivePerfumes(perfumeIds) != perfumeIds.size()) {
            throw new BusinessException(CommunityErrorCode.COMMUNITY_PERFUME_NOT_FOUND);
        }
    }

    private <T> List<T> orEmpty(List<T> values) {
        return values == null ? List.of() : values;
    }

    private Long currentUserId() {
        return currentUser.id()
                .orElseThrow(() ->
                        new BusinessException(CommunityErrorCode.COMMUNITY_LOGIN_REQUIRED));
    }
}
