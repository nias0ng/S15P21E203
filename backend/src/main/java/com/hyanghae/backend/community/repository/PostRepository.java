package com.hyanghae.backend.community.repository;

import com.hyanghae.backend.community.dto.response.PostPerfumeResponse;
import com.hyanghae.backend.community.entity.Post;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

/**
 * 자유 게시판 글을 읽고 씁니다.
 *
 * <p>쓰기와 단건 조회는 JPA 가 합니다. 글에 딸린 이미지·향수는 {@link Post} 가 함께 관리하므로
 * 저장과 삭제에 따로 문장을 쓸 일이 없습니다.
 *
 * <p><b>목록과 대표 향수만 네이티브 쿼리입니다.</b> 이유가 둘입니다. 목록은 작성자 닉네임이
 * 필요한데 사용자 엔티티가 없어 JPQL 로 {@code users} 를 조인할 수 없습니다. 대표 향수는
 * PostgreSQL 의 {@code DISTINCT ON} 을 쓰는데 JPQL 에 같은 기능이 없습니다.
 */
@Repository
public interface PostRepository extends JpaRepository<Post, Long> {

    /**
     * 목록 한 줄에 실을 값입니다.
     *
     * <p>댓글 수와 좋아요 수는 딸린 쿼리로 셉니다. {@code idx_comments_post}(V12)와
     * {@code post_likes} 의 기본키가 모두 글 번호로 시작해 표를 보지 않고 셀 수 있습니다.
     *
     * <p>조회수만 저장된 값을 그대로 읽습니다. 좋아요는 누가 눌렀는지 기록이 있어 세면 되지만,
     * 조회는 비로그인도 하는 일이라 기록할 표가 없습니다. 대신 숫자를 직접 올립니다.
     */
    String SELECT_COLUMNS = """
            SELECT p.post_id AS postId, c.code AS category, p.title AS title,
                   u.nickname AS nickname,
                   u.profile_image_url AS profileImageUrl,
                   p.created_at AS createdAt,
                   p.view_count AS viewCount,
                   (SELECT COUNT(*)
                      FROM comments cm
                     WHERE cm.post_id = p.post_id) AS commentCount,
                   (SELECT COUNT(*)
                      FROM post_likes pl
                     WHERE pl.post_id = p.post_id) AS likeCount
            """;

    /**
     * 목록과 개수가 같은 범위를 보도록 조건을 묶어 둡니다. 한쪽만 고치면 마지막 페이지가 비거나
     * 개수가 맞지 않습니다.
     *
     * <p>분류를 주지 않으면 전체입니다. {@code CAST} 를 쓰는 이유는 PostgreSQL 이 바인딩된
     * {@code NULL} 의 타입을 모르면 비교를 거부하기 때문입니다.
     */
    String FROM_AND_WHERE = """
            FROM posts p
            LEFT JOIN users u ON u.user_id = p.user_id
            LEFT JOIN post_categories c ON c.category_id = p.category_id
            WHERE (CAST(:category AS VARCHAR) IS NULL OR c.code = :category)
            """;

    /**
     * 최신순입니다. {@code created_at} 이 비어 있는 행은 뒤로 밀고, 시각이 같으면 {@code post_id}
     * 로 순서를 확정합니다. 순서가 흔들리면 페이지를 넘길 때 같은 글이 두 번 나오거나 어떤 글이
     * 아예 안 보입니다.
     */
    String ORDER_RECENT = """
            ORDER BY p.created_at DESC NULLS LAST, p.post_id DESC
            LIMIT :limit OFFSET :offset
            """;

    /**
     * 댓글이 많은 순입니다.
     *
     * <p>댓글 수가 같은 글이 흔하므로 최신순과 글 번호까지 이어 붙여 순서를 확정합니다. 첫 기준만
     * 두면 같은 글이 두 페이지에 나오거나 어떤 글이 아예 빠집니다.
     *
     * <p>{@code commentCount} 는 위에서 붙인 별칭입니다. 같은 딸린 쿼리를 두 번 쓰지 않습니다.
     */
    String ORDER_COMMENTS = """
            ORDER BY commentCount DESC, p.created_at DESC NULLS LAST, p.post_id DESC
            LIMIT :limit OFFSET :offset
            """;

    /**
     * 좋아요가 많은 순입니다. 뒤에 최신순과 글 번호를 이어 붙이는 이유는 댓글 순과 같습니다.
     *
     * <p>{@code likeCount} 는 위에서 붙인 별칭입니다. 같은 딸린 쿼리를 두 번 쓰지 않습니다.
     */
    String ORDER_LIKES = """
            ORDER BY likeCount DESC, p.created_at DESC NULLS LAST, p.post_id DESC
            LIMIT :limit OFFSET :offset
            """;

    /**
     * 조회가 많은 순입니다. 저장된 값이라 V13 의 {@code idx_posts_views} 를 그대로 훑습니다.
     *
     * <p>다만 분류를 걸면 그 인덱스를 쓰지 못합니다. 분류별 조회 순 인덱스까지 두지는 않았습니다.
     * 글 수가 그만큼 늘면 그때 더합니다.
     */
    String ORDER_VIEWS = """
            ORDER BY p.view_count DESC, p.created_at DESC NULLS LAST, p.post_id DESC
            LIMIT :limit OFFSET :offset
            """;

    @Query(value = SELECT_COLUMNS + FROM_AND_WHERE + ORDER_RECENT, nativeQuery = true)
    List<PostListRow> findPageByRecent(
            @Param("category") String category,
            @Param("limit") int limit,
            @Param("offset") long offset
    );

    @Query(value = SELECT_COLUMNS + FROM_AND_WHERE + ORDER_COMMENTS, nativeQuery = true)
    List<PostListRow> findPageByComments(
            @Param("category") String category,
            @Param("limit") int limit,
            @Param("offset") long offset
    );

    @Query(value = SELECT_COLUMNS + FROM_AND_WHERE + ORDER_LIKES, nativeQuery = true)
    List<PostListRow> findPageByLikes(
            @Param("category") String category,
            @Param("limit") int limit,
            @Param("offset") long offset
    );

    @Query(value = SELECT_COLUMNS + FROM_AND_WHERE + ORDER_VIEWS, nativeQuery = true)
    List<PostListRow> findPageByViews(
            @Param("category") String category,
            @Param("limit") int limit,
            @Param("offset") long offset
    );

    /**
     * 조회수를 하나 올립니다.
     *
     * <p>읽어서 더하고 저장하지 않고 <b>표에게 더하라고 시킵니다.</b> 두 사람이 동시에 열면 둘 다
     * 같은 값을 읽어 같은 값을 쓰게 되어 한 번이 사라집니다. 이 문장은 그런 틈이 없습니다.
     */
    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("UPDATE Post p SET p.viewCount = p.viewCount + 1 WHERE p.id = :postId")
    int increaseViewCount(@Param("postId") Long postId);

    @Query(value = "SELECT COUNT(*) " + FROM_AND_WHERE, nativeQuery = true)
    long countPage(@Param("category") String category);

    /**
     * 목록 한 줄에 실을 대표 향수입니다. 글마다 하나씩만 가져옵니다.
     *
     * <p>페이지에 있는 글 번호를 모아 한 번에 읽습니다. 글마다 따로 조회하면 한 페이지에 쿼리가
     * 스무 번 나갑니다.
     *
     * <p>{@code DISTINCT ON} 은 PostgreSQL 기능으로, 괄호 안 컬럼이 같은 행들 중 {@code ORDER BY}
     * 로 정한 첫 행만 남깁니다. 그래서 글마다 화면에 먼저 걸어 둔 향수 하나가 남습니다.
     */
    @Query(value = """
            SELECT DISTINCT ON (pp.post_id)
                   pp.post_id AS postId, pp.perfume_id AS perfumeId,
                   p.name AS name, p.name_ko AS nameKo,
                   b.name AS brand, b.name_ko AS brandKo
            FROM post_perfumes pp
            JOIN perfumes p ON p.perfume_id = pp.perfume_id
            LEFT JOIN brands b ON b.brand_id = p.brand_id
            WHERE pp.post_id IN (:postIds)
            ORDER BY pp.post_id, pp.display_order NULLS LAST, pp.perfume_id
            """, nativeQuery = true)
    List<PostPerfumeRow> findRepresentativePerfumes(@Param("postIds") Collection<Long> postIds);

    /**
     * 글 상세에 실을 작성자입니다. 사용자 엔티티가 없어 따로 읽습니다.
     *
     * <p>탈퇴한 작성자는 빈 {@link Optional} 입니다. 글은 남고 작성자만 지워집니다. 화면은 그런
     * 글을 "탈퇴한 회원" 으로 그리고 기본 아바타를 보여줍니다.
     */
    @Query(value = """
            SELECT nickname AS nickname, profile_image_url AS profileImageUrl
            FROM users
            WHERE user_id = :userId
            """, nativeQuery = true)
    Optional<PostAuthorRow> findAuthor(@Param("userId") Long userId);

    /** 상세의 댓글 수입니다. */
    @Query("""
            SELECT COUNT(c)
            FROM Comment c
            WHERE c.post.id = :postId
            """)
    long countComments(@Param("postId") Long postId);

    /** 글에 걸어 둔 순서 그대로입니다. */
    @Query("""
            SELECT i.imageUrl
            FROM PostImage i
            WHERE i.post.id = :postId
            ORDER BY i.displayOrder, i.id
            """)
    List<String> findImageUrls(@Param("postId") Long postId);

    /** 브랜드가 없는 향수가 있어 왼쪽 조인입니다. */
    @Query("""
            SELECT new com.hyanghae.backend.community.dto.response.PostPerfumeResponse(
                       p.id, p.name, p.nameKo, b.name, b.nameKo)
            FROM PostPerfume pp
            JOIN pp.perfume p
            LEFT JOIN p.brand b
            WHERE pp.post.id = :postId
            ORDER BY pp.displayOrder, p.id
            """)
    List<PostPerfumeResponse> findPerfumes(@Param("postId") Long postId);
}
