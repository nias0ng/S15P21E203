package com.hyanghae.backend.community.repository;

import com.hyanghae.backend.community.dto.response.PostPerfumeResponse;
import com.hyanghae.backend.community.entity.Post;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
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
    @Query(value = """
            SELECT p.post_id AS postId, c.code AS category, p.title AS title,
                   u.nickname AS nickname, p.created_at AS createdAt
            """ + FROM_AND_WHERE + """
            ORDER BY p.created_at DESC NULLS LAST, p.post_id DESC
            LIMIT :limit OFFSET :offset
            """, nativeQuery = true)
    List<PostListRow> findPage(
            @Param("category") String category,
            @Param("limit") int limit,
            @Param("offset") long offset
    );

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
                   p.name AS name, b.name AS brand
            FROM post_perfumes pp
            JOIN perfumes p ON p.perfume_id = pp.perfume_id
            LEFT JOIN brands b ON b.brand_id = p.brand_id
            WHERE pp.post_id IN (:postIds)
            ORDER BY pp.post_id, pp.display_order NULLS LAST, pp.perfume_id
            """, nativeQuery = true)
    List<PostPerfumeRow> findRepresentativePerfumes(@Param("postIds") Collection<Long> postIds);

    /**
     * 작성자 닉네임입니다. 사용자 엔티티가 없어 따로 읽습니다.
     *
     * <p>탈퇴한 작성자는 빈 {@link Optional} 입니다. 글은 남고 작성자만 지워집니다.
     */
    @Query(value = "SELECT nickname FROM users WHERE user_id = :userId", nativeQuery = true)
    Optional<String> findNickname(@Param("userId") Long userId);

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
                       p.id, p.name, b.name)
            FROM PostPerfume pp
            JOIN pp.perfume p
            LEFT JOIN p.brand b
            WHERE pp.post.id = :postId
            ORDER BY pp.displayOrder, p.id
            """)
    List<PostPerfumeResponse> findPerfumes(@Param("postId") Long postId);
}
