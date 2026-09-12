package com.hyanghae.backend.community.repository;

import com.hyanghae.backend.community.dto.response.PostPerfumeResponse;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.OffsetDateTime;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

/**
 * 게시글과 딸린 값들을 읽고 씁니다.
 *
 * <p>여기서 다루는 게시글은 <b>자유 게시판 글</b>입니다. 후기는 {@code perfume_reviews} 에 있고
 * {@code review} 도메인이 담당합니다. 두 가지를 모두 "글" 이라고 부르면 헷갈리므로, 이 클래스가
 * 읽는 {@code posts} 는 자유 게시판 하나만 담습니다.
 *
 * <p>엔티티를 만들지 않고 SQL 을 직접 씁니다. 글 하나가 분류·이미지·향수 세 곳에 걸쳐 있고 수정이
 * 부분 갱신이라, 영속성 컨텍스트를 거치기보다 바뀌는 값만 문장으로 쓰는 편이 읽힙니다. 향수
 * 도메인이 글을 읽는 {@code PerfumePostRepository} 도 같은 방식입니다.
 *
 * <p>분류는 번호가 아니라 <b>코드</b>로 주고받습니다. 번호는 자동 증가라 환경마다 다르고, 화면은
 * 와이어프레임이 정한 코드만 알고 있습니다.
 */
@Repository
public class PostRepository {

    /**
     * 목록과 개수의 조회 범위는 항상 같아야 합니다. 한쪽만 고치면 마지막 페이지가 비거나 개수가
     * 맞지 않으므로, 두 쿼리가 같은 {@code FROM}/{@code WHERE} 를 쓰도록 상수로 묶었습니다.
     *
     * <p>분류를 주지 않으면 전체입니다. {@code CAST} 를 쓰는 이유는 PostgreSQL 이 바인딩된
     * {@code NULL} 의 타입을 모르면 비교를 거부하기 때문입니다.
     */
    private static final String FROM_AND_WHERE = """
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
    private static final String SELECT_PAGE = """
            SELECT p.post_id, c.code AS category_code, p.title, u.nickname, p.created_at
            """ + FROM_AND_WHERE + """
            ORDER BY p.created_at DESC NULLS LAST, p.post_id DESC
            LIMIT :limit OFFSET :offset
            """;

    private static final String COUNT_ALL = "SELECT COUNT(*) " + FROM_AND_WHERE;

    /**
     * 목록 한 줄에 실을 대표 향수입니다. 글마다 하나씩만 가져옵니다.
     *
     * <p>페이지에 있는 글 번호를 모아 한 번에 읽습니다. 글마다 따로 조회하면 한 페이지에 쿼리가
     * 스무 번 나갑니다.
     *
     * <p>{@code DISTINCT ON} 은 PostgreSQL 기능으로, 괄호 안 컬럼이 같은 행들 중 {@code ORDER BY}
     * 로 정한 첫 행만 남깁니다. 그래서 글마다 화면에 먼저 걸어 둔 향수 하나가 남습니다.
     */
    private static final String SELECT_REPRESENTATIVE_PERFUMES = """
            SELECT DISTINCT ON (pp.post_id)
                   pp.post_id, pp.perfume_id, p.name, b.name AS brand
            FROM post_perfumes pp
            JOIN perfumes p ON p.perfume_id = pp.perfume_id
            LEFT JOIN brands b ON b.brand_id = p.brand_id
            WHERE pp.post_id IN (:postIds)
            ORDER BY pp.post_id, pp.display_order NULLS LAST, pp.perfume_id
            """;

    /**
     * 글 하나입니다. 작성자가 탈퇴하면 {@code user_id} 가 비고 닉네임도 비어 나갑니다. 분류는
     * 반드시 있어야 하는 값이지만 예전 데이터를 위해 왼쪽 조인으로 둡니다.
     */
    private static final String SELECT_DETAIL = """
            SELECT p.post_id, p.user_id, p.category_id, p.title, p.content,
                   p.created_at, p.updated_at,
                   u.nickname,
                   c.code AS category_code
            FROM posts p
            LEFT JOIN users u ON u.user_id = p.user_id
            LEFT JOIN post_categories c ON c.category_id = p.category_id
            WHERE p.post_id = :postId
            """;

    private static final String SELECT_IMAGES = """
            SELECT image_url
            FROM post_images
            WHERE post_id = :postId
            ORDER BY display_order NULLS LAST, image_id
            """;

    private static final String SELECT_PERFUMES = """
            SELECT pp.perfume_id, p.name, b.name AS brand
            FROM post_perfumes pp
            JOIN perfumes p ON p.perfume_id = pp.perfume_id
            LEFT JOIN brands b ON b.brand_id = p.brand_id
            WHERE pp.post_id = :postId
            ORDER BY pp.display_order NULLS LAST, pp.perfume_id
            """;

    /**
     * 글을 넣습니다. 시각은 데이터베이스가 넣습니다. 애플리케이션이 만든 시각을 쓰면 인스턴스마다
     * 시계가 조금씩 달라 목록의 최신순이 뒤섞입니다.
     *
     * <p>{@code updated_at} 을 만들 때부터 채웁니다. 비워 두면 "고친 적 없음" 을 화면이 따로
     * 다뤄야 하고, 목록·상세가 매번 두 값을 비교하게 됩니다.
     */
    private static final String INSERT_POST = """
            INSERT INTO posts (user_id, category_id, title, content, created_at, updated_at)
            VALUES (:userId, :categoryId, :title, :content, NOW(), NOW())
            RETURNING post_id, created_at
            """;

    private static final String UPDATE_POST = """
            UPDATE posts
            SET category_id = :categoryId,
                title = :title,
                content = :content,
                updated_at = NOW()
            WHERE post_id = :postId
            RETURNING updated_at
            """;

    private static final String DELETE_POST = "DELETE FROM posts WHERE post_id = :postId";

    private static final String INSERT_IMAGE = """
            INSERT INTO post_images (post_id, image_url, display_order)
            VALUES (:postId, :imageUrl, :displayOrder)
            """;

    private static final String DELETE_IMAGES = "DELETE FROM post_images WHERE post_id = :postId";

    private static final String INSERT_PERFUME = """
            INSERT INTO post_perfumes (post_id, perfume_id, display_order)
            VALUES (:postId, :perfumeId, :displayOrder)
            """;

    private static final String DELETE_PERFUMES =
            "DELETE FROM post_perfumes WHERE post_id = :postId";

    /** 분류는 활성인 것만 고를 수 있습니다. 내린 분류로 새 글을 쓰게 두면 화면에 없는 탭이 생깁니다. */
    private static final String SELECT_ACTIVE_CATEGORY_ID = """
            SELECT category_id
            FROM post_categories
            WHERE code = :category
              AND is_active = TRUE
            """;

    /** 글에 걸 수 있는 향수는 활성 향수뿐입니다. */
    private static final String COUNT_ACTIVE_PERFUMES = """
            SELECT COUNT(*)
            FROM perfumes
            WHERE perfume_id IN (:perfumeIds)
              AND is_active = TRUE
            """;

    private final JdbcClient jdbcClient;

    public PostRepository(JdbcClient jdbcClient) {
        this.jdbcClient = jdbcClient;
    }

    /** 대표 향수는 여기 없습니다. 서비스가 {@link #findRepresentativePerfumes} 로 채웁니다. */
    public List<PostListRow> findPage(String category, int limit, long offset) {
        return jdbcClient.sql(SELECT_PAGE)
                .param("category", category)
                .param("limit", limit)
                .param("offset", offset)
                .query((rs, rowNum) -> new PostListRow(
                        rs.getLong("post_id"),
                        rs.getString("category_code"),
                        rs.getString("title"),
                        rs.getString("nickname"),
                        rs.getObject("created_at", OffsetDateTime.class)
                ))
                .list();
    }

    public long count(String category) {
        return jdbcClient.sql(COUNT_ALL)
                .param("category", category)
                .query(Long.class)
                .single();
    }

    /** 글 번호별 대표 향수입니다. 향수를 걸지 않은 글은 결과에 없습니다. */
    public List<PostPerfumeRow> findRepresentativePerfumes(Collection<Long> postIds) {
        if (postIds.isEmpty()) {
            return List.of();
        }
        return jdbcClient.sql(SELECT_REPRESENTATIVE_PERFUMES)
                .param("postIds", postIds)
                .query((rs, rowNum) -> new PostPerfumeRow(
                        rs.getLong("post_id"),
                        toPerfume(rs)
                ))
                .list();
    }

    /** 없는 글은 빈 {@link Optional} 입니다. */
    public Optional<PostRow> findById(Long postId) {
        return jdbcClient.sql(SELECT_DETAIL)
                .param("postId", postId)
                .query((rs, rowNum) -> new PostRow(
                        rs.getLong("post_id"),
                        rs.getObject("user_id", Long.class),
                        rs.getObject("category_id", Long.class),
                        rs.getString("category_code"),
                        rs.getString("nickname"),
                        rs.getString("title"),
                        rs.getString("content"),
                        rs.getObject("created_at", OffsetDateTime.class),
                        rs.getObject("updated_at", OffsetDateTime.class)
                ))
                .optional();
    }

    public List<String> findImageUrls(Long postId) {
        return jdbcClient.sql(SELECT_IMAGES)
                .param("postId", postId)
                .query(String.class)
                .list();
    }

    public List<PostPerfumeResponse> findPerfumes(Long postId) {
        return jdbcClient.sql(SELECT_PERFUMES)
                .param("postId", postId)
                .query((rs, rowNum) -> toPerfume(rs))
                .list();
    }

    public CreatedPost insert(Long userId, Long categoryId, String title, String content) {
        return jdbcClient.sql(INSERT_POST)
                .param("userId", userId)
                .param("categoryId", categoryId)
                .param("title", title)
                .param("content", content)
                .query((rs, rowNum) -> new CreatedPost(
                        rs.getLong("post_id"),
                        rs.getObject("created_at", OffsetDateTime.class)
                ))
                .single();
    }

    public OffsetDateTime update(Long postId, Long categoryId, String title, String content) {
        return jdbcClient.sql(UPDATE_POST)
                .param("postId", postId)
                .param("categoryId", categoryId)
                .param("title", title)
                .param("content", content)
                .query(OffsetDateTime.class)
                .single();
    }

    public void delete(Long postId) {
        jdbcClient.sql(DELETE_POST).param("postId", postId).update();
    }

    /** 이미지를 통째로 바꿉니다. 화면이 목록 전체를 보내므로 지우고 다시 넣습니다. */
    public void replaceImages(Long postId, List<String> imageUrls) {
        jdbcClient.sql(DELETE_IMAGES).param("postId", postId).update();
        for (int order = 0; order < imageUrls.size(); order++) {
            jdbcClient.sql(INSERT_IMAGE)
                    .param("postId", postId)
                    .param("imageUrl", imageUrls.get(order))
                    .param("displayOrder", order)
                    .update();
        }
    }

    /** 향수 연결을 통째로 바꿉니다. */
    public void replacePerfumes(Long postId, List<Long> perfumeIds) {
        jdbcClient.sql(DELETE_PERFUMES).param("postId", postId).update();
        for (int order = 0; order < perfumeIds.size(); order++) {
            jdbcClient.sql(INSERT_PERFUME)
                    .param("postId", postId)
                    .param("perfumeId", perfumeIds.get(order))
                    .param("displayOrder", order)
                    .update();
        }
    }

    /** 내려간 분류나 없는 분류는 빈 {@link Optional} 입니다. */
    public Optional<Long> findActiveCategoryId(String category) {
        return jdbcClient.sql(SELECT_ACTIVE_CATEGORY_ID)
                .param("category", category)
                .query(Long.class)
                .optional();
    }

    /** 활성 향수의 수입니다. 보낸 수와 다르면 없거나 내려간 향수가 섞인 것입니다. */
    public long countActivePerfumes(Collection<Long> perfumeIds) {
        if (perfumeIds.isEmpty()) {
            return 0;
        }
        return jdbcClient.sql(COUNT_ACTIVE_PERFUMES)
                .param("perfumeIds", perfumeIds)
                .query(Long.class)
                .single();
    }

    /** {@code brand} 가 비어 있을 수 있습니다. 브랜드가 없는 향수가 인계 데이터에 있습니다. */
    private static PostPerfumeResponse toPerfume(ResultSet rs) throws SQLException {
        return new PostPerfumeResponse(
                rs.getLong("perfume_id"),
                rs.getString("name"),
                rs.getString("brand")
        );
    }
}
