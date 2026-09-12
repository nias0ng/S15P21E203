package com.hyanghae.backend.perfume.repository;

import com.hyanghae.backend.perfume.dto.response.PerfumePostResponse;
import java.time.OffsetDateTime;
import java.util.List;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

/**
 * 향수에 연결된 자유 게시판 글을 읽습니다.
 *
 * <p>후기는 여기 없습니다. 후기는 {@code perfume_reviews} 에 있고 {@code review} 도메인이
 * 읽습니다. 향수 상세 화면은 두 가지를 각각 다른 자리에 보여줍니다.
 *
 * <p>다른 리포지토리와 달리 JPA 가 아니라 SQL 을 직접 씁니다. {@code posts} 는 커뮤니티 도메인의
 * 테이블이라 여기서 엔티티를 만들면 두 벌이 됩니다. 커뮤니티의 {@code PostRepository} 도 엔티티
 * 없이 SQL 을 쓰므로 {@code Post} 엔티티는 생기지 않습니다.
 *
 * <p>게시글 상태로 거르지 않습니다. 게시글 보류 기능이 없어지면서 {@code posts.status} 가 V5 에서
 * 삭제됐습니다. 글은 있거나 지워졌거나 둘 중 하나입니다.
 */
@Repository
public class PerfumePostRepository {

    /**
     * 목록과 개수의 조회 범위는 항상 같아야 합니다. 한쪽만 고치면 마지막 페이지가 비거나 개수가
     * 맞지 않으므로, 두 쿼리가 같은 {@code FROM}/{@code WHERE} 를 쓰도록 상수로 묶었습니다.
     */
    private static final String FROM_AND_WHERE = """
            FROM posts p
            JOIN post_perfumes pp ON pp.post_id = p.post_id
            WHERE pp.perfume_id = :perfumeId
            """;

    /**
     * 최신순입니다. {@code created_at} 이 {@code NULL} 인 행은 뒤로 밀고, 시각이 같으면
     * {@code post_id} 로 순서를 확정합니다. 순서가 흔들리면 페이지를 넘길 때 같은 글이 두 번
     * 나오거나 어떤 글이 아예 안 보입니다.
     */
    private static final String SELECT_PAGE = """
            SELECT p.post_id AS post_id, p.title AS title, p.created_at AS created_at
            """ + FROM_AND_WHERE + """
            ORDER BY p.created_at DESC NULLS LAST, p.post_id DESC
            LIMIT :limit OFFSET :offset
            """;

    private static final String COUNT_ALL = "SELECT COUNT(*) " + FROM_AND_WHERE;

    private final JdbcClient jdbcClient;

    public PerfumePostRepository(JdbcClient jdbcClient) {
        this.jdbcClient = jdbcClient;
    }

    public List<PerfumePostResponse> findPageByPerfumeId(Long perfumeId, int limit, long offset) {
        return jdbcClient.sql(SELECT_PAGE)
                .param("perfumeId", perfumeId)
                .param("limit", limit)
                .param("offset", offset)
                .query((rs, rowNum) -> {
                    // pgjdbc 는 timestamptz 를 Instant 로 바로 주지 않습니다. OffsetDateTime 을
                    // 거쳐야 하고, 컬럼이 NULL 이면 여기서도 null 입니다.
                    OffsetDateTime createdAt = rs.getObject("created_at", OffsetDateTime.class);
                    return new PerfumePostResponse(
                            rs.getLong("post_id"),
                            rs.getString("title"),
                            createdAt == null ? null : createdAt.toInstant());
                })
                .list();
    }

    public long countByPerfumeId(Long perfumeId) {
        return jdbcClient.sql(COUNT_ALL)
                .param("perfumeId", perfumeId)
                .query(Long.class)
                .single();
    }
}
