package com.hyanghae.backend.perfume.repository;

import com.hyanghae.backend.perfume.dto.request.ShelfFilter;
import java.util.List;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

/**
 * 사용자들이 담거나 열어 본 향수를 많이 담긴 순으로 읽습니다. 검색의 진열대 필터가 씁니다.
 *
 * <p>특정 사용자가 아니라 <b>전체 사용자 집계</b>입니다. "내가 담은 향수"가 아니라 "사람들이 담은
 * 향수"라서 요청자가 누구인지 알 필요가 없고, 로그인 없이 씁니다.
 *
 * <p>{@code user_perfumes} 는 진열대 도메인, {@code user_perfume_views} 는 지도·이력 도메인의
 * 테이블입니다. 향수 검색이 다른 도메인의 엔티티에 의존하지 않도록 필요한 식별자만 SQL로 읽습니다.
 *
 * <p>향수 번호만 돌려주고 필터링은 검색 쿼리가 합니다. 여기서 향수까지 조인하면 검색 조건이 두 곳에
 * 나뉘어, 한쪽만 고쳤을 때 전체 개수와 목록이 어긋납니다.
 *
 * <p>집계를 미리 계산해 두지 않고 조회할 때마다 셉니다. 향수마다 한 행으로 묶이므로 결과는 카탈로그
 * 크기를 넘지 않습니다. 담은 기록 100만 행으로 재 보니 50ms 였고, 그마저도 담자마자 순위에
 * 반영되는 것과 바꿀 만한 값이 아닙니다. 집계 컬럼을 따로 두면 담기와 순위가 어긋나는 순간이 생깁니다.
 */
@Repository
public class PerfumeShelfRepository {

    /**
     * 담은 사람이 많은 향수부터 조회합니다. 진열대 해제는 행을 물리 삭제하므로 남아 있는 행이 곧
     * 현재 담겨 있는 것입니다.
     *
     * <p>같은 사람이 같은 향수를 두 번 담을 수 없습니다({@code uk_user_perfumes_user_perfume}).
     * 그래서 행 수가 곧 담은 사람 수입니다.
     */
    private static final String OWNERSHIP_SQL = """
            SELECT perfume_id
            FROM user_perfumes
            WHERE ownership_status = :ownershipStatus
              AND perfume_id IS NOT NULL
            GROUP BY perfume_id
            ORDER BY COUNT(*) DESC, perfume_id
            """;

    /**
     * 많이 열어 본 향수부터 조회합니다.
     *
     * <p>진열대와 달리 조회 기록은 한 사람이 같은 향수를 여러 번 남깁니다. 그래서 사람 수로 세지
     * 않고 열어 본 횟수로 셉니다. 사람 수로 바꾸려면 {@code COUNT(DISTINCT user_id)} 인데, 어느
     * 쪽이 맞는지는 화면에서 "많이 본 향수"를 무엇으로 정의하느냐에 달려 있습니다.
     */
    private static final String VIEWED_SQL = """
            SELECT perfume_id
            FROM user_perfume_views
            WHERE perfume_id IS NOT NULL
            GROUP BY perfume_id
            ORDER BY COUNT(*) DESC, perfume_id
            """;

    private final JdbcClient jdbcClient;

    public PerfumeShelfRepository(JdbcClient jdbcClient) {
        this.jdbcClient = jdbcClient;
    }

    /**
     * 조건에 해당하는 향수 번호를 많이 담긴 순으로 돌려줍니다. 하나도 없으면 빈 목록입니다.
     *
     * <p>한 사람이라도 담았으면 포함합니다. 담긴 횟수로 자르지 않습니다. 기준으로 삼을 숫자가
     * 정해지지 않았고, 사용자가 적은 동안에는 어떤 임계값을 두어도 결과가 늘 비기 때문입니다.
     *
     * <p>같은 횟수면 향수 번호순입니다. 순서를 확정하지 않으면 같은 요청이 페이지마다 다른 답을
     * 주어, 2페이지에 1페이지 항목이 다시 나옵니다.
     *
     * <p><b>돌려주는 순서가 곧 화면에 나가는 순서입니다.</b> 호출하는 쪽이 이 순서를 지켜야 합니다.
     */
    public List<Long> findPerfumeIdsOrderedBySaveCount(ShelfFilter shelf) {
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
