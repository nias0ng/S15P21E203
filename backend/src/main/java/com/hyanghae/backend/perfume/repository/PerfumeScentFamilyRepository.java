package com.hyanghae.backend.perfume.repository;

import java.util.Collection;
import java.util.HashMap;
import java.util.Map;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

/**
 * 향수가 향 지도에서 속한 향 계열을 읽습니다.
 *
 * <p>{@code perfume_map_points} 와 {@code scent_regions} 는 향 지도 도메인의 테이블입니다. 그쪽이
 * 아직 엔티티를 만들지 않았고 여기서 먼저 만들면 나중에 두 벌이 되므로, 진열대 필터·관련 게시글과
 * 같은 방식으로 SQL 을 직접 읽습니다.
 *
 * <p>검색 쿼리에 조인해 붙이지 않고 따로 조회하는 이유는 대표 이미지와 같습니다. 조회한 페이지의
 * 향수들만 한 번에 가져오므로 질의는 한 번이고, 향수 목록 쿼리는 향 지도 테이블을 몰라도 됩니다.
 *
 * <p>{@code scent_regions.is_active} 는 보지 않습니다. 비활성 구역이라도 이미 그 구역에 있는
 * 향수에는 표시할 이름이 필요합니다.
 */
@Repository
public class PerfumeScentFamilyRepository {

    private static final String SELECT_BY_PERFUME_IDS = """
            SELECT m.perfume_id AS perfume_id, r.code AS code
            FROM perfume_map_points m
            JOIN scent_regions r ON r.scent_region_id = m.scent_region_id
            WHERE m.perfume_id IN (:perfumeIds)
            """;

    private final JdbcClient jdbcClient;

    public PerfumeScentFamilyRepository(JdbcClient jdbcClient) {
        this.jdbcClient = jdbcClient;
    }

    /**
     * 향수별 향 계열 코드입니다. 향 지도에 자리가 없는 향수는 결과에 들어 있지 않습니다.
     * 호출하는 쪽에서 없는 값은 {@code null} 로 다뤄야 합니다.
     */
    public Map<Long, String> findByPerfumeIds(Collection<Long> perfumeIds) {
        if (perfumeIds.isEmpty()) {
            return Map.of();
        }

        Map<Long, String> scentFamilies = new HashMap<>();
        jdbcClient.sql(SELECT_BY_PERFUME_IDS)
                .param("perfumeIds", perfumeIds)
                .query((rs, rowNum) ->
                        scentFamilies.put(rs.getLong("perfume_id"), rs.getString("code")))
                .list();
        return scentFamilies;
    }
}
