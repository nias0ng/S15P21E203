package com.hyanghae.backend.perfume.repository;

import com.hyanghae.backend.perfume.dto.request.RankingType;
import com.hyanghae.backend.perfume.dto.response.PerfumeSummaryResponse;
import java.util.List;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

/**
 * 사람들이 많이 담거나 열어 본 순으로 향수를 읽습니다. 검색의 {@code ranking} 이 씁니다.
 *
 * <p>특정 사용자가 아니라 <b>전체 사용자 집계</b>입니다. 보유·위시는 세 명 이상이 담은 향수만
 * 나옵니다({@link #MIN_SAVE_COUNT}).
 *
 * <p>{@code user_perfumes} 는 진열대 도메인, {@code user_perfume_views} 는 지도·이력 도메인의
 * 테이블입니다. 향수 검색이 다른 도메인의 엔티티에 의존하지 않도록 SQL 로 직접 읽습니다.
 *
 * <h2>왜 집계·정렬·페이징을 전부 여기서 하는가</h2>
 *
 * <p>이전에는 담긴 향수 번호를 전부 받아 와서 애플리케이션이 자르는 방식이었습니다. 향수 13만종
 * 환경에서 재 보니 두 가지가 걸렸습니다. 번호 13만 개가 {@code IN} 절 파라미터가 되어
 * PostgreSQL 의 상한 65,535 를 넘겨 <b>요청이 실패했고</b>, 상한을 넘기지 않는 범위에서도 매
 * 요청마다 13만 개를 만들어 20 개만 쓰고 버렸습니다.
 *
 * <p>지금은 한 페이지에 필요한 만큼만 DB 가 돌려줍니다. 카탈로그가 커져도 오가는 양이 늘지
 * 않습니다. 13만종에서 목록 207ms, 전체 개수 173ms 이고 마지막 페이지도 213ms 로 같습니다.
 *
 * <h2>왜 JPQL 이 아니라 SQL 인가</h2>
 *
 * <p>집계를 파생 테이블로 한 번만 계산해 조인해야 하는데 JPQL 로는 표현되지 않습니다. 상관
 * 서브쿼리로 바꿔 보니 후보 13만 행마다 집계가 돌아 <b>425 초</b>가 나왔습니다.
 *
 * <p>그래서 검색 조건이 {@link PerfumeRepository#SEARCH_CONDITION} 과 여기, 두 벌이 됩니다.
 * 한쪽만 고치면 조용히 결과가 갈라지므로 두 경로가 같은 답을 내는지 확인하는 통합 테스트를
 * 두었습니다.
 */
@Repository
public class PerfumeRankingRepository {

    /**
     * 보유·위시 순위에 오르는 최소 인원입니다. 이 수보다 적게 담긴 향수는 결과에서 빠집니다.
     *
     * <p>한 명이 담았다는 것만으로는 "사람들이 담은 향수"라고 하기 어렵습니다. 취향이 특이한 한
     * 사람이 담은 향수가 순위 앞자리에 올라오면 목록이 추천으로 읽히지 않습니다. 여럿이 같은
     * 판단을 했다는 신호가 되려면 최소한의 수가 필요합니다.
     *
     * <p>초기에는 이 하한 때문에 목록이 비어 보일 수 있습니다. 사용자가 쌓이기 전까지는 세 명이
     * 같은 향수를 담는 일 자체가 드뭅니다. 빈 목록이 부담스러워지면 이 값을 내리면 됩니다.
     */
    private static final int MIN_SAVE_COUNT = 3;

    /**
     * 검색 조건입니다. {@link PerfumeRepository#SEARCH_CONDITION} 의 SQL 판이라 두 곳이 같아야
     * 합니다. {@code CAST} 가 필요한 이유도 같습니다. 파라미터를 맨몸으로 쓰면 PostgreSQL 이
     * 타입을 추론하지 못해 {@code bytea} 로 바인딩하고 {@code lower()} 에서 실패합니다.
     */
    private static final String CONDITION = """
              AND (CAST(:keyword AS varchar) IS NULL
                OR LOWER(p.name) LIKE LOWER(CONCAT('%', CAST(:keyword AS varchar), '%')) ESCAPE '!'
                OR LOWER(p.name_ko) LIKE LOWER(CONCAT('%', CAST(:keyword AS varchar), '%')) ESCAPE '!'
                OR LOWER(b.name) LIKE LOWER(CONCAT('%', CAST(:keyword AS varchar), '%')) ESCAPE '!')
              AND (CAST(:brand AS varchar) IS NULL OR b.name = CAST(:brand AS varchar))
              AND (CAST(:brandId AS bigint) IS NULL OR b.brand_id = CAST(:brandId AS bigint))
              AND (CAST(:gender AS varchar) IS NULL OR p.gender = CAST(:gender AS varchar))
            """;

    /**
     * 담은 사람 수로 줄 세웁니다. 같은 사람이 같은 향수를 두 번 담을 수 없으므로
     * ({@code uk_user_perfumes_user_perfume}) 행 수가 곧 사람 수입니다.
     */
    private static final String SAVE_COUNT = """
            SELECT perfume_id, COUNT(*) AS c
            FROM user_perfumes
            WHERE ownership_status = :ownershipStatus AND perfume_id IS NOT NULL
            GROUP BY perfume_id
            HAVING COUNT(*) >= %d
            """.formatted(MIN_SAVE_COUNT);

    /**
     * 열어 본 횟수로 줄 세웁니다. 조회 기록은 한 사람이 같은 향수를 여러 번 남기므로 사람 수와
     * 다릅니다. 사람 수로 바꾸려면 {@code COUNT(DISTINCT user_id)} 입니다.
     *
     * <p>여기에는 {@link #MIN_SAVE_COUNT} 같은 하한이 없습니다. 담기는 여러 사람이 같은 판단을
     * 했다는 신호라 몇 명부터인지가 의미를 갖지만, 조회는 한 사람이 여러 번 남길 수 있어 같은
     * 숫자가 같은 뜻이 아닙니다. 조회에 하한을 둔다면 몇 회가 아니라 몇 명을 기준으로 삼아야
     * 하고, 그건 세는 방식을 먼저 정해야 하는 이야기입니다.
     */
    private static final String VIEW_COUNT = """
            SELECT perfume_id, COUNT(*) AS c
            FROM user_perfume_views
            WHERE perfume_id IS NOT NULL
            GROUP BY perfume_id
            """;

    /**
     * 국내 선정 순위로 줄 세웁니다. 사용자 기록이 아니라 편집이 고른 목록입니다.
     *
     * <p><b>순위를 음수로 뒤집습니다.</b> 1위가 가장 앞에 와야 하는데 바깥 쿼리가
     * {@code ORDER BY s.c DESC} 로 굳어 있습니다. 여기서 부호만 바꾸면 그 정렬을 그대로 쓰면서
     * 1위가 맨 앞에 옵니다 — {@code 201 - rank} 처럼 상한을 적어 넣으면 순위가 200개를 넘는 날
     * 조용히 뒤집힙니다.
     *
     * <p>하한이 없습니다. 순위가 있다는 것 자체가 이미 골랐다는 뜻이라 몇 위까지인지를 따로 정할
     * 이유가 없습니다.
     */
    private static final String SELECTION_RANK = """
            SELECT perfume_id, -korea_selection_rank AS c
            FROM perfumes
            WHERE korea_selection_rank IS NOT NULL
            """;

    /** 동점은 향수 번호순입니다. 순서를 확정하지 않으면 페이지마다 다른 답이 나옵니다. */
    private static final String SELECT_PAGE = """
            SELECT p.perfume_id, p.name, p.name_ko, b.name AS brand_name, b.name_ko AS brand_name_ko
            FROM perfumes p
            LEFT JOIN brands b ON b.brand_id = p.brand_id
            JOIN (%s) s ON s.perfume_id = p.perfume_id
            WHERE p.is_active = true
            %s
            ORDER BY s.c DESC, p.perfume_id
            LIMIT :limit OFFSET :offset
            """;

    private static final String SELECT_COUNT = """
            SELECT COUNT(*)
            FROM perfumes p
            LEFT JOIN brands b ON b.brand_id = p.brand_id
            JOIN (%s) s ON s.perfume_id = p.perfume_id
            WHERE p.is_active = true
            %s
            """;

    private final JdbcClient jdbcClient;

    public PerfumeRankingRepository(JdbcClient jdbcClient) {
        this.jdbcClient = jdbcClient;
    }

    /** 한 페이지 분량입니다. 기준에 못 미치는 향수는 조인에서 빠집니다. */
    public List<PerfumeSummaryResponse> findPage(
            RankingType ranking, String keyword, String brand, Long brandId, String gender,
            int offset, int limit) {
        return bind(SELECT_PAGE.formatted(countSource(ranking), CONDITION),
                ranking, keyword, brand, brandId, gender)
                .param("limit", limit)
                .param("offset", offset)
                .query((rs, rowNum) -> new PerfumeSummaryResponse(
                        rs.getLong("perfume_id"),
                        rs.getString("name"),
                        rs.getString("name_ko"),
                        rs.getString("brand_name"),
                        rs.getString("brand_name_ko")))
                .list();
    }

    /** 조건에 맞는 전체 개수입니다. 목록과 같은 조건을 써야 마지막 페이지가 비지 않습니다. */
    public long count(
            RankingType ranking, String keyword, String brand, Long brandId, String gender) {
        return bind(SELECT_COUNT.formatted(countSource(ranking), CONDITION),
                ranking, keyword, brand, brandId, gender)
                .query(Long.class)
                .single();
    }

    private JdbcClient.StatementSpec bind(
            String sql, RankingType ranking, String keyword, String brand, Long brandId,
            String gender) {
        JdbcClient.StatementSpec spec = jdbcClient.sql(sql)
                .param("keyword", keyword)
                .param("brand", brand)
                .param("brandId", brandId)
                .param("gender", gender);
        // VIEWED 와 POPULAR 는 진열대를 보지 않아 이 파라미터가 쿼리에 없습니다.
        if (ranking == RankingType.OWNED || ranking == RankingType.WISH) {
            spec = spec.param("ownershipStatus", ranking.ownershipStatus());
        }
        return spec;
    }

    private String countSource(RankingType ranking) {
        return switch (ranking) {
            case VIEWED -> VIEW_COUNT;
            case POPULAR -> SELECTION_RANK;
            case OWNED, WISH -> SAVE_COUNT;
        };
    }
}
