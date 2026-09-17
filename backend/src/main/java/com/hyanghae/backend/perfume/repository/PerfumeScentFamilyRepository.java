package com.hyanghae.backend.perfume.repository;

import java.util.Collection;
import java.util.HashMap;
import java.util.Map;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

/**
 * 향수의 대표 향 계열을 읽습니다.
 *
 * <p>향수 하나가 향 계열 1~3개를 비중과 함께 가집니다. 검색 결과는 뱃지 하나를 그리므로 비중이
 * 가장 큰 계열을 대표로 씁니다. 대표를 따로 저장해 두지 않는 이유는, 값을 두 군데 두면 적재가
 * 한쪽만 갱신했을 때 조용히 어긋나기 때문입니다.
 *
 * <p>{@code perfume_scent_families} 와 {@code scent_regions} 는 향 지도 도메인의 테이블입니다.
 * 그쪽이 아직 엔티티를 만들지 않았고 여기서 먼저 만들면 나중에 두 벌이 되므로, 진열대 필터·관련
 * 게시글과 같은 방식으로 SQL 을 직접 읽습니다.
 *
 * <p>검색 쿼리에 조인해 붙이지 않고 따로 조회하는 이유는 대표 이미지와 같습니다. 조회한 페이지의
 * 향수들만 한 번에 가져오므로 질의는 한 번이고, 향수 목록 쿼리는 향 지도 테이블을 몰라도 됩니다.
 *
 * <p>{@code scent_regions.is_active} 는 보지 않습니다. 비활성 계열이라도 이미 그 계열에 속한
 * 향수에는 표시할 이름이 필요합니다.
 */
@Repository
public class PerfumeScentFamilyRepository {

    /**
     * {@code DISTINCT ON} 이 향수별로 {@code ORDER BY} 의 첫 행만 남깁니다. 비중이 가장 큰 계열이
     * 대표이고, 비중이 같으면 계열 번호로 순서를 확정해 같은 향수가 매번 같은 답을 갖게 합니다.
     */
    private static final String SELECT_DOMINANT_BY_PERFUME_IDS = """
            SELECT DISTINCT ON (f.perfume_id) f.perfume_id AS perfume_id, r.code AS code
            FROM perfume_scent_families f
            JOIN scent_regions r ON r.scent_region_id = f.scent_region_id
            WHERE f.perfume_id IN (:perfumeIds)
            ORDER BY f.perfume_id, f.weight DESC NULLS LAST, r.scent_region_id
            """;

    private final JdbcClient jdbcClient;

    public PerfumeScentFamilyRepository(JdbcClient jdbcClient) {
        this.jdbcClient = jdbcClient;
    }

    /**
     * 향수별 대표 향 계열 코드입니다. 향 계열이 없는 향수는 결과에 들어 있지 않습니다.
     * 호출하는 쪽에서 없는 값은 {@code null} 로 다뤄야 합니다.
     */
    public Map<Long, String> findByPerfumeIds(Collection<Long> perfumeIds) {
        if (perfumeIds.isEmpty()) {
            return Map.of();
        }

        Map<Long, String> scentFamilies = new HashMap<>();
        jdbcClient.sql(SELECT_DOMINANT_BY_PERFUME_IDS)
                .param("perfumeIds", perfumeIds)
                .query((rs, rowNum) ->
                        scentFamilies.put(rs.getLong("perfume_id"), rs.getString("code")))
                .list();
        return scentFamilies;
    }
}
