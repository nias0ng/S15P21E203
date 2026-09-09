package com.hyanghae.backend.perfume.repository;

import com.hyanghae.backend.perfume.dto.request.ShelfFilter;
import java.util.List;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

/**
 * 사용자들이 담거나 열어 본 향수를 읽습니다. 검색의 진열대 필터가 씁니다.
 *
 * <p>특정 사용자가 아니라 <b>전체 사용자 집계</b>입니다. "내가 담은 향수"가 아니라 "사람들이 담은
 * 향수"라서 요청자가 누구인지 알 필요가 없고, 로그인 없이 씁니다.
 *
 * <p>{@code user_perfumes} 는 진열대 도메인, {@code user_perfume_views} 는 지도·이력 도메인의
 * 테이블입니다. 향수 검색이 다른 도메인의 엔티티에 의존하지 않도록 필요한 식별자만 SQL로 읽습니다.
 *
 * <p>향수 번호만 돌려주고 필터링은 검색 쿼리가 합니다. 여기서 향수까지 조인하면 검색 조건이 두 곳에
 * 나뉘어, 한쪽만 고쳤을 때 전체 개수와 목록이 어긋납니다.
 */
@Repository
public class PerfumeShelfRepository {

    /** 물리 삭제되지 않고 현재 진열대에 남아 있는 항목에서 향수 번호를 조회합니다. */
    private static final String OWNERSHIP_SQL = """
            SELECT DISTINCT perfume_id
            FROM user_perfumes
            WHERE ownership_status = :ownershipStatus
              AND perfume_id IS NOT NULL
            """;

    /**
     * {@code DISTINCT} 는 넘길 번호 목록을 짧게 유지하기 위한 것입니다. 정확성을 위한 것이
     * 아닙니다. 중복이 섞여도 SQL 의 {@code IN} 은 같은 값을 한 번으로 보므로 결과가 같습니다.
     * 이 {@code DISTINCT} 를 지워도 실패하는 테스트가 없다는 것을 확인했습니다.
     */
    private static final String VIEWED_SQL = """
            SELECT DISTINCT perfume_id
            FROM user_perfume_views
            WHERE perfume_id IS NOT NULL
            """;

    private final JdbcClient jdbcClient;

    public PerfumeShelfRepository(JdbcClient jdbcClient) {
        this.jdbcClient = jdbcClient;
    }

    /**
     * 조건에 해당하는 향수 번호입니다. 하나도 없으면 빈 목록입니다.
     *
     * <p>한 사람이라도 담았으면 포함합니다. 담긴 횟수로 자르지 않습니다. 기준으로 삼을 숫자가
     * 정해지지 않았고, 사용자가 적은 동안에는 어떤 임계값을 두어도 결과가 늘 비기 때문입니다.
     */
    public List<Long> findPerfumeIds(ShelfFilter shelf) {
        if (shelf == ShelfFilter.VIEWED) {
            return jdbcClient.sql(VIEWED_SQL)
                    .query(Long.class)
                    .list();
        }

        return jdbcClient.sql(OWNERSHIP_SQL)
                .param("ownershipStatus", shelf.ownershipStatus())
                .query(Long.class)
                .list();
    }
}
