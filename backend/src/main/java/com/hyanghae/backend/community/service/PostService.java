package com.hyanghae.backend.community.service;

import com.hyanghae.backend.community.dto.request.PostCreateRequest;
import com.hyanghae.backend.community.dto.request.PostUpdateRequest;
import com.hyanghae.backend.community.dto.response.PostCreateResponse;
import com.hyanghae.backend.community.dto.response.PostDetailResponse;
import com.hyanghae.backend.community.dto.response.PostPerfumeResponse;
import com.hyanghae.backend.community.dto.response.PostSummaryResponse;
import com.hyanghae.backend.community.dto.response.PostUpdateResponse;
import com.hyanghae.backend.community.dto.response.PostsResponse;
import com.hyanghae.backend.community.exception.CommunityErrorCode;
import com.hyanghae.backend.community.repository.CreatedPost;
import com.hyanghae.backend.community.repository.PostListRow;
import com.hyanghae.backend.community.repository.PostPerfumeRow;
import com.hyanghae.backend.community.repository.PostRepository;
import com.hyanghae.backend.community.repository.PostRow;
import com.hyanghae.backend.global.exception.BusinessException;
import com.hyanghae.backend.global.security.CurrentUser;
import java.time.OffsetDateTime;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 게시글을 쓰고 고치고 지우고 읽습니다.
 *
 * <p>여기서 다루는 게시글은 <b>자유 게시판 글</b>입니다. 후기는 향수에 매달리는 다른 자료이고
 * {@code review} 도메인이 담당합니다. 후기 게시판 화면도 후기 쪽 자료를 보여줍니다.
 *
 * <p>읽기는 로그인이 필요 없습니다. 게시판은 누구나 볼 수 있어야 합니다. 다만 상세의
 * {@code mine} 은 보는 사람에 따라 달라지므로 로그인 여부를 <b>참고</b>합니다. 로그인을
 * 요구하는 것과 로그인 여부를 참고하는 것은 다릅니다. 쓰기 셋은 로그인이 필요합니다.
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
        Long userId = requireLogin();
        Long categoryId = requireActiveCategory(request.category());

        List<Long> perfumeIds = distinctPerfumeIds(request.perfumeIds());
        requireActivePerfumes(perfumeIds);
        List<String> imageUrls = orEmpty(request.imageUrls());

        CreatedPost created = postRepository.insert(
                userId, categoryId, request.title().strip(), request.content().strip());
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
                ? requireActiveCategory(request.getCategory())
                : post.categoryId();
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
     *
     * <p>대표 향수는 한 번에 모아 읽습니다. 글마다 따로 조회하면 한 페이지에 쿼리가 스무 번
     * 나갑니다.
     */
    @Transactional(readOnly = true)
    public PostsResponse findPage(String category, int page, int size) {
        int pageNumber = Math.max(page, 0);
        int pageSize = Math.clamp(size, 1, MAX_PAGE_SIZE);

        List<PostListRow> rows =
                postRepository.findPage(category, pageSize, (long) pageNumber * pageSize);
        Map<Long, PostPerfumeResponse> perfumes = representativePerfumes(rows);

        List<PostSummaryResponse> posts = rows.stream()
                .map(row -> new PostSummaryResponse(
                        row.postId(),
                        row.category(),
                        row.title(),
                        row.nickname(),
                        perfumes.get(row.postId()),
                        row.createdAt()
                ))
                .toList();

        return new PostsResponse(
                posts, pageNumber, pageSize, postRepository.count(category));
    }

    /** 게시글 상세입니다. 없는 글은 404 입니다. */
    @Transactional(readOnly = true)
    public PostDetailResponse findOne(Long postId) {
        PostRow post = requirePost(postId);

        return new PostDetailResponse(
                post.postId(),
                post.categoryCode(),
                post.nickname(),
                post.title(),
                post.content(),
                postRepository.findImageUrls(postId),
                postRepository.findPerfumes(postId),
                isMine(post),
                post.createdAt(),
                post.updatedAt()
        );
    }

    private Map<Long, PostPerfumeResponse> representativePerfumes(List<PostListRow> rows) {
        List<Long> postIds = rows.stream().map(PostListRow::postId).toList();

        return postRepository.findRepresentativePerfumes(postIds).stream()
                .collect(Collectors.toMap(PostPerfumeRow::postId, PostPerfumeRow::perfume));
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
        if (!Objects.equals(post.authorId(), requireLogin())) {
            throw new BusinessException(CommunityErrorCode.COMMUNITY_POST_NOT_OWNED);
        }
        return post;
    }

    /**
     * 내가 쓴 글인지입니다. 화면이 수정·삭제 버튼을 띄울지 정하는 데 씁니다.
     *
     * <p>여기서는 로그인을 <b>요구하지 않습니다.</b> 비로그인이면 그냥 거짓입니다. 상세 조회는
     * 누구나 할 수 있어야 하므로 401 을 던지면 안 됩니다.
     */
    private boolean isMine(PostRow post) {
        return post.authorId() != null
                && currentUser.id().map(post.authorId()::equals).orElse(false);
    }

    private Long requireActiveCategory(String category) {
        return postRepository.findActiveCategoryId(category)
                .orElseThrow(() ->
                        new BusinessException(CommunityErrorCode.COMMUNITY_CATEGORY_NOT_FOUND));
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

    private Long requireLogin() {
        return currentUser.id()
                .orElseThrow(() ->
                        new BusinessException(CommunityErrorCode.COMMUNITY_LOGIN_REQUIRED));
    }
}
