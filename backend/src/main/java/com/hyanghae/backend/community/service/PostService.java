package com.hyanghae.backend.community.service;

import com.hyanghae.backend.community.dto.request.PostCreateRequest;
import com.hyanghae.backend.community.dto.request.PostUpdateRequest;
import com.hyanghae.backend.community.dto.response.PostCreateResponse;
import com.hyanghae.backend.community.dto.response.PostDetailResponse;
import com.hyanghae.backend.community.dto.response.PostLikeResponse;
import com.hyanghae.backend.community.dto.response.PostPerfumeResponse;
import com.hyanghae.backend.community.dto.response.PostSummaryResponse;
import com.hyanghae.backend.community.dto.response.PostUpdateResponse;
import com.hyanghae.backend.community.dto.response.PostsResponse;
import com.hyanghae.backend.community.entity.Post;
import com.hyanghae.backend.community.entity.PostCategory;
import com.hyanghae.backend.community.exception.CommunityErrorCode;
import com.hyanghae.backend.community.repository.PostCategoryRepository;
import com.hyanghae.backend.community.repository.PostLikeRepository;
import com.hyanghae.backend.community.repository.PostListRow;
import com.hyanghae.backend.community.repository.PostPerfumeRow;
import com.hyanghae.backend.community.repository.PostRepository;
import com.hyanghae.backend.community.repository.PostSort;
import com.hyanghae.backend.collection.entity.Collection;
import com.hyanghae.backend.collection.repository.CollectionRepository;
import com.hyanghae.backend.global.exception.BusinessException;
import com.hyanghae.backend.global.security.CurrentUser;
import com.hyanghae.backend.perfume.entity.Perfume;
import com.hyanghae.backend.perfume.repository.PerfumeRepository;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;
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
    private final PostLikeRepository postLikeRepository;
    private final PostCategoryRepository postCategoryRepository;
    private final CollectionRepository collectionRepository;
    private final PerfumeRepository perfumeRepository;
    private final CurrentUser currentUser;

    public PostService(
            PostRepository postRepository,
            PostLikeRepository postLikeRepository,
            PostCategoryRepository postCategoryRepository,
            CollectionRepository collectionRepository,
            PerfumeRepository perfumeRepository,
            CurrentUser currentUser
    ) {
        this.postRepository = postRepository;
        this.postLikeRepository = postLikeRepository;
        this.postCategoryRepository = postCategoryRepository;
        this.collectionRepository = collectionRepository;
        this.perfumeRepository = perfumeRepository;
        this.currentUser = currentUser;
    }

    /**
     * 글을 씁니다. 분류는 활성인 것이어야 하고, 거는 향수도 활성이어야 합니다.
     *
     * <p>향수와 이미지는 보낸 순서를 그대로 보여줄 순서로 씁니다. 글에 딸린 값이라 글을 저장하면
     * 함께 저장됩니다.
     */
    @Transactional
    public PostCreateResponse create(PostCreateRequest request) {
        Long userId = requireLogin();
        PostCategory category = requireActiveCategory(request.category());
        Collection collection = findMyCollection(request.collectionId());
        List<Perfume> perfumes = perfumesFor(collection, request.perfumeIds());

        Post post = Post.create(
                userId,
                category,
                request.title(),
                request.content(),
                collection,
                OffsetDateTime.now()
        );
        post.addPerfumes(perfumes);
        post.replaceImages(orEmpty(request.imageUrls()));

        postRepository.save(post);

        return new PostCreateResponse(post.getId(), post.getCreatedAt());
    }

    /**
     * 글에 걸 향수를 정합니다. <b>출처는 하나뿐입니다.</b>
     *
     * <p>컬렉션을 붙이면 그 컬렉션에 담긴 향수가 그대로 글의 향수가 됩니다. 글 하나에 향수 목록이
     * 하나라서 직접 고른 목록과 컬렉션이 함께 오면 어느 쪽을 쓸지 정할 수 없습니다. 조용히 한쪽을
     * 버리면 화면은 보낸 대로 저장됐다고 믿으므로 400 으로 돌려줍니다.
     *
     * <p>컬렉션의 향수를 <b>복사</b>합니다. 글을 쓸 때의 모습을 박제하는 것이라, 나중에 컬렉션에서
     * 향수를 빼도 글은 그대로입니다.
     */
    private List<Perfume> perfumesFor(Collection collection, List<Long> perfumeIds) {
        if (collection == null) {
            return requireActivePerfumes(perfumeIds);
        }
        if (perfumeIds != null && !perfumeIds.isEmpty()) {
            throw new BusinessException(CommunityErrorCode.COMMUNITY_PERFUMES_FROM_COLLECTION);
        }
        return requireActivePerfumes(collectionRepository.findPerfumeIds(collection.getId()));
    }

    /**
     * 글을 고칩니다. 보낸 항목만 바뀌고 나머지는 그대로입니다.
     *
     * <p>향수와 이미지는 보낸 목록으로 통째로 바뀝니다. 빈 배열을 보내면 연결이 모두 지워집니다.
     */
    @Transactional
    public PostUpdateResponse update(Long postId, PostUpdateRequest request) {
        Post post = requireMyPost(postId);

        PostCategory category = request.isCategoryPresent()
                ? requireActiveCategory(request.getCategory())
                : post.getCategory();
        String title = request.isTitlePresent() ? request.getTitle() : post.getTitle();
        String content = request.isContentPresent()
                ? request.getContent()
                : post.getContent();

        post.update(category, title, content, OffsetDateTime.now());

        if (request.isCollectionPresent()) {
            Collection collection = findMyCollection(request.getCollectionId());
            post.attachCollection(collection);
            if (collection != null) {
                replacePerfumes(post, collectionRepository.findPerfumeIds(collection.getId()));
            }
        }
        // 컬렉션을 먼저 처리했으므로, 여기서 컬렉션이 남아 있으면 향수 출처가 컬렉션입니다.
        // 목록을 따로 보내려면 같은 요청에서 collectionId 를 null 로 보내 컬렉션을 떼야 합니다.
        if (request.isPerfumesPresent()) {
            if (post.getCollection() != null) {
                throw new BusinessException(CommunityErrorCode.COMMUNITY_PERFUMES_FROM_COLLECTION);
            }
            replacePerfumes(post, request.getPerfumeIds());
        }
        if (request.isImagesPresent()) {
            post.replaceImages(request.getImageUrls());
        }

        return new PostUpdateResponse(post.getId(), post.getUpdatedAt());
    }

    /**
     * 글을 지웁니다. 이미지와 향수 연결은 글이 함께 지웁니다.
     *
     * <p>댓글은 외래키가 지웁니다({@code comments.post_id} 가 {@code ON DELETE CASCADE} 입니다).
     */
    @Transactional
    public void delete(Long postId) {
        postRepository.delete(requireMyPost(postId));
    }

    /**
     * 게시글 목록입니다. 최신순이고 분류로 거를 수 있습니다.
     *
     * <p>분류를 주지 않으면 전체입니다. 페이지 크기는 1~100 으로 자릅니다.
     *
     * <p>정렬은 넷입니다 — 최신순·조회 순·좋아요 순·댓글 많은 순.
     *
     * <p>대표 향수와 내가 누른 좋아요는 각각 한 번에 모아 읽습니다. 글마다 따로 조회하면 한
     * 페이지에 쿼리가 스무 번씩 나갑니다.
     */
    @Transactional(readOnly = true)
    public PostsResponse findPage(String category, PostSort sort, int page, int size) {
        int pageNumber = Math.max(page, 0);
        int pageSize = Math.clamp(size, 1, MAX_PAGE_SIZE);
        long offset = (long) pageNumber * pageSize;

        List<PostListRow> rows = switch (sort) {
            case RECENT -> postRepository.findPageByRecent(category, pageSize, offset);
            case VIEWS -> postRepository.findPageByViews(category, pageSize, offset);
            case LIKES -> postRepository.findPageByLikes(category, pageSize, offset);
            case COMMENTS -> postRepository.findPageByComments(category, pageSize, offset);
        };
        Map<Long, PostPerfumeResponse> perfumes = representativePerfumes(rows);
        Set<Long> liked = likedAmong(rows);

        List<PostSummaryResponse> posts = rows.stream()
                .map(row -> new PostSummaryResponse(
                        row.getPostId(),
                        row.getCategory(),
                        row.getTitle(),
                        row.getNickname(),
                        perfumes.get(row.getPostId()),
                        row.getCommentCount(),
                        row.getLikeCount(),
                        row.getViewCount(),
                        liked.contains(row.getPostId()),
                        OffsetDateTime.ofInstant(row.getCreatedAt(), ZoneId.systemDefault())
                ))
                .toList();

        return new PostsResponse(
                posts, pageNumber, pageSize, postRepository.countPage(category));
    }

    /**
     * 게시글 상세입니다. 없는 글은 404 입니다.
     *
     * <p><b>읽기 전용이 아닙니다.</b> 여는 것이 곧 조회이므로 여기서 조회수를 올립니다. 화면이
     * 따로 "봤다" 고 알리게 하면 요청이 한 번 더 오가고, 그 요청을 빠뜨린 화면은 조회가 세지지
     * 않습니다.
     *
     * <p>올린 뒤에 읽습니다. 순서를 바꾸면 방금 올린 것이 빠진 숫자가 나가서, 열었는데 그대로인
     * 것처럼 보입니다.
     */
    @Transactional
    public PostDetailResponse findOne(Long postId) {
        if (postRepository.increaseViewCount(postId) == 0) {
            throw new BusinessException(CommunityErrorCode.COMMUNITY_POST_NOT_FOUND);
        }
        Post post = requirePost(postId);

        return new PostDetailResponse(
                post.getId(),
                post.getCategory() == null ? null : post.getCategory().getCode(),
                nicknameOf(post),
                post.getTitle(),
                post.getContent(),
                postRepository.findImageUrls(postId),
                postRepository.findPerfumes(postId),
                collectionIdOf(post),
                collectionTitleOf(post),
                postRepository.countComments(postId),
                postLikeRepository.countOfPost(postId),
                post.getViewCount(),
                isLikedByMe(postId),
                isMine(post),
                post.getCreatedAt(),
                post.getUpdatedAt()
        );
    }

    /**
     * 좋아요를 누릅니다. 여러 번 눌러도 결과가 같습니다.
     *
     * <p>이미 누른 글에 또 누르면 아무 일도 일어나지 않고 지금 상태를 그대로 돌려줍니다. 오류가
     * 아닙니다. 사용자가 원한 상태("좋아요가 눌려 있다")가 이미 이루어져 있기 때문입니다.
     */
    @Transactional
    public PostLikeResponse like(Long postId) {
        Long userId = requireLogin();
        requirePost(postId);
        postLikeRepository.like(postId, userId);

        return new PostLikeResponse(postId, true, postLikeRepository.countOfPost(postId));
    }

    /** 좋아요를 취소합니다. 누르지 않은 글에 취소해도 오류가 아닙니다. */
    @Transactional
    public PostLikeResponse unlike(Long postId) {
        Long userId = requireLogin();
        requirePost(postId);
        postLikeRepository.unlike(postId, userId);

        return new PostLikeResponse(postId, false, postLikeRepository.countOfPost(postId));
    }

    /**
     * 이 목록에서 내가 좋아요를 누른 글입니다.
     *
     * <p>비로그인이면 빈 집합입니다. 목록은 누구나 볼 수 있어야 하므로 로그인을 요구하지 않습니다.
     */
    private Set<Long> likedAmong(List<PostListRow> rows) {
        Optional<Long> userId = currentUser.id();
        if (userId.isEmpty() || rows.isEmpty()) {
            return Set.of();
        }
        List<Long> postIds = rows.stream().map(PostListRow::getPostId).toList();
        return Set.copyOf(postLikeRepository.findLikedPostIds(userId.get(), postIds));
    }

    /** 내가 좋아요를 눌렀는지입니다. 비로그인이면 거짓입니다. */
    private boolean isLikedByMe(Long postId) {
        return currentUser.id()
                .map(userId -> postLikeRepository.isLikedBy(postId, userId))
                .orElse(false);
    }

    /**
     * 향수 연결을 통째로 바꿉니다.
     *
     * <p>비우고 담는 사이에 {@code flush} 를 한 번 끼웁니다. {@code post_perfumes} 의 기본키가
     * (글, 향수)인데 Hibernate 는 한 번의 flush 에서 INSERT 를 DELETE 보다 먼저 내보냅니다. 같은
     * 향수를 그대로 두는 수정이라면 지우기 전에 넣으려다 기본키 충돌로 실패합니다.
     */
    private void replacePerfumes(Post post, List<Long> perfumeIds) {
        List<Perfume> perfumes = requireActivePerfumes(perfumeIds);

        post.clearPerfumes();
        postRepository.flush();
        post.addPerfumes(perfumes);
    }

    /**
     * 첨부할 컬렉션입니다. 보내지 않으면 첨부가 없습니다.
     *
     * <p><b>내 컬렉션만 붙일 수 있습니다.</b> 컬렉션은 사용자에게 매달린 자료라 남의 것을 내 글에
     * 걸 수 없습니다. 없는 컬렉션과 남의 컬렉션을 같은 404 로 답합니다. 컬렉션은 누구나 볼 수 있는
     * 자료가 아니라 존재를 숨기는 편이 맞습니다. 남의 글을 403 으로 답하는 것과 반대 이유입니다.
     */
    private Collection findMyCollection(Long collectionId) {
        if (collectionId == null) {
            return null;
        }
        return collectionRepository.findByIdAndUserId(collectionId, requireLogin())
                .orElseThrow(() ->
                        new BusinessException(CommunityErrorCode.COMMUNITY_COLLECTION_NOT_FOUND));
    }

    /** 첨부한 컬렉션이 지워졌으면 비어 있습니다. */
    private Long collectionIdOf(Post post) {
        return post.getCollection() == null ? null : post.getCollection().getId();
    }

    /**
     * 글을 쓸 때 박제한 컬렉션 이름입니다.
     *
     * <p>컬렉션을 그때그때 읽지 않습니다. 이름을 바꾸면 몇 달 전 글의 이름까지 같이 바뀌고,
     * 컬렉션을 지우면 글에 남는 것이 없어집니다. 글은 그때 그 컬렉션을 소개한 기록입니다.
     */
    private String collectionTitleOf(Post post) {
        return post.getCollectionName();
    }

    private Map<Long, PostPerfumeResponse> representativePerfumes(List<PostListRow> rows) {
        List<Long> postIds = rows.stream().map(PostListRow::getPostId).toList();
        if (postIds.isEmpty()) {
            return Map.of();
        }

        return postRepository.findRepresentativePerfumes(postIds).stream()
                .collect(Collectors.toMap(
                        PostPerfumeRow::getPostId,
                        row -> new PostPerfumeResponse(
                                row.getPerfumeId(), row.getName(), row.getBrand())
                ));
    }

    private Post requirePost(Long postId) {
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
    private Post requireMyPost(Long postId) {
        Post post = requirePost(postId);
        if (!Objects.equals(post.getUserId(), requireLogin())) {
            throw new BusinessException(CommunityErrorCode.COMMUNITY_POST_NOT_OWNED);
        }
        return post;
    }

    /** 탈퇴한 작성자의 글은 닉네임이 비어 나갑니다. */
    private String nicknameOf(Post post) {
        if (post.getUserId() == null) {
            return null;
        }
        return postRepository.findNickname(post.getUserId()).orElse(null);
    }

    /**
     * 내가 쓴 글인지입니다. 화면이 수정·삭제 버튼을 띄울지 정하는 데 씁니다.
     *
     * <p>여기서는 로그인을 <b>요구하지 않습니다.</b> 비로그인이면 그냥 거짓입니다. 상세 조회는
     * 누구나 할 수 있어야 하므로 401 을 던지면 안 됩니다.
     */
    private boolean isMine(Post post) {
        return post.getUserId() != null
                && currentUser.id().map(post.getUserId()::equals).orElse(false);
    }

    private PostCategory requireActiveCategory(String category) {
        return postCategoryRepository.findByCodeAndActiveTrue(category)
                .orElseThrow(() ->
                        new BusinessException(CommunityErrorCode.COMMUNITY_CATEGORY_NOT_FOUND));
    }

    /**
     * 글에 걸 향수를 <b>보낸 순서대로</b> 찾습니다. 없거나 내려간 향수가 섞이면 404 입니다.
     *
     * <p>같은 향수를 두 번 걸 수 없습니다. {@code post_perfumes} 의 기본키가 (글, 향수)라 어차피
     * 두 번은 들어가지 않습니다. 조용히 하나로 합치지 않고 400 으로 돌려주는 이유는, 화면이
     * 중복을 보냈다는 것은 목록을 잘못 만들고 있다는 뜻이기 때문입니다.
     *
     * <p>조회 결과는 순서를 보장하지 않으므로 번호로 다시 줄 세웁니다. 순서가 곧 화면에 보일
     * 순서입니다.
     */
    private List<Perfume> requireActivePerfumes(List<Long> perfumeIds) {
        List<Long> ids = orEmpty(perfumeIds);
        if (new HashSet<>(ids).size() != ids.size()) {
            throw new BusinessException(CommunityErrorCode.COMMUNITY_POST_INVALID);
        }
        if (ids.isEmpty()) {
            return List.of();
        }

        Map<Long, Perfume> found = perfumeRepository.findAllByIdInAndActiveTrue(ids).stream()
                .collect(Collectors.toMap(Perfume::getId, Function.identity()));
        if (found.size() != ids.size()) {
            throw new BusinessException(CommunityErrorCode.COMMUNITY_PERFUME_NOT_FOUND);
        }

        return ids.stream().map(found::get).toList();
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
