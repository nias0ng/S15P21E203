package com.hyanghae.backend.perfume.repository;

import com.hyanghae.backend.perfume.dto.request.ShelfFilter;
import java.util.List;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

/**
 * 로그인한 사용자와 향수의 관계를 읽습니다. 검색의 진열대 필터가 씁니다.
 *
 * <p>{@code user_perfumes} 는 진열대 도메인, {@code user_perfume_views} 는 지도·이력 도메인의
 * 테이블입니다. 두 도메인이 아직 엔티티를 만들지 않았고 여기서 먼저 만들면 나중에 두 벌이 되므로,
 * 관련 게시글 조회와 같은 방식으로 SQL 을 직접 읽습니다. 엔티티가 생기면 이 클래스만 바꾸면 됩니다.
 *
 * <p>향수 번호만 돌려주고 필터링은 검색 쿼리가 합니다. 여기서 향수까지 조인하면 검색 조건이 두 곳에
 * 나뉘어, 한쪽만 고쳤을 때 전체 개수와 목록이 어긋납니다.
 */
@Repository
public class PerfumeShelfRepository {

    /**
     * {@code deleted_at} 이 핵심입니다. 진열대에서 뺀 향수는 행이 남고 이 값만 채워집니다.
     * 조건을 빼면 이미 치운 향수가 계속 걸립니다.
     */
    private static final String OWNERSHIP_SQL = """
            SELECT DISTINCT perfume_id
            FROM user_perfumes
            WHERE user_id = :userId
              AND ownership_status = :ownershipStatus
              AND deleted_at IS NULL
              AND perfume_id IS NOT NULL
            """;

    /** 같은 향수를 여러 번 봐도 한 번만 셉니다. */
    private static final String VIEWED_SQL = """
            SELECT DISTINCT perfume_id
            FROM user_perfume_views
            WHERE user_id = :userId
              AND perfume_id IS NOT NULL
            """;

    private final JdbcClient jdbcClient;

    public PerfumeShelfRepository(JdbcClient jdbcClient) {
        this.jdbcClient = jdbcClient;
    }

    /** 조건에 해당하는 향수 번호입니다. 하나도 없으면 빈 목록입니다. */
    public List<Long> findPerfumeIds(Long userId, ShelfFilter shelf) {
        if (shelf == ShelfFilter.VIEWED) {
            return jdbcClient.sql(VIEWED_SQL)
                    .param("userId", userId)
                    .query(Long.class)
                    .list();
        }

        return jdbcClient.sql(OWNERSHIP_SQL)
                .param("userId", userId)
                .param("ownershipStatus", shelf.ownershipStatus())
                .query(Long.class)
                .list();
    }
}
