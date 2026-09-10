package com.hyanghae.backend.map.repository;

import com.hyanghae.backend.map.dto.request.MapViewportCondition;
import com.hyanghae.backend.map.dto.response.MapPerfumeDetailResponse;
import com.hyanghae.backend.map.dto.response.MapPerfumeResponse;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

/**
 * 향 지도를 읽습니다.
 *
 * <p>엔티티를 만들지 않고 SQL 을 직접 읽습니다. 이 도메인이 하는 일은 지금 조회뿐이고, 향 계열
 * 영역의 {@code polygon} 은 JSONB 이며 대표 계열은 {@code DISTINCT ON} 성격의 질의라 JPQL 보다
 * SQL 이 그대로 읽힙니다. {@code perfume_scent_families} 를 같은 방식으로 읽는 곳이 향수 도메인에
 * 이미 있습니다({@code PerfumeScentFamilyRepository}).
 *
 * <p>향수 목록은 {@code perfume_map_points} 를 기준으로 시작합니다. 좌표가 없는 향수는 지도에
 * 찍을 자리가 없어 애초에 결과에 들어오지 않습니다.
 */
@Repository
public class ScentMapRepository {

    /**
     * 활성 계열만, 범례 순서로 돌려줍니다.
     *
     * <p>{@code display_order} 가 비어 있는 계열은 뒤로 밀고 계열 번호로 순서를 확정합니다.
     * 정렬이 흔들리면 지도 범례의 순서가 요청마다 달라집니다.
     */
    private static final String SELECT_ACTIVE_REGIONS = """
            SELECT scent_region_id, code, name, display_order, anchor_x, anchor_y, polygon
            FROM scent_regions
            WHERE is_active = TRUE
            ORDER BY display_order NULLS LAST, scent_region_id
            """;

    /**
     * 대표 향 계열은 비중이 가장 큰 행입니다. 비중이 같으면 계열 번호로 순서를 확정해 같은 향수가
     * 매번 같은 대표를 갖게 합니다. 계열이 하나도 없는 향수도 지도에는 찍혀야 하므로 왼쪽 조인입니다.
     */
    private static final String DOMINANT_REGION_JOIN = """
            LEFT JOIN LATERAL (
                SELECT f.scent_region_id
                FROM perfume_scent_families f
                WHERE f.perfume_id = mp.perfume_id
                ORDER BY f.weight DESC NULLS LAST, f.scent_region_id
                LIMIT 1
            ) dominant ON TRUE
            """;

    private static final String SELECT_MAP_PERFUMES = """
            SELECT p.perfume_id, p.name, mp.map_x, mp.map_y, dominant.scent_region_id
            FROM perfume_map_points mp
            JOIN perfumes p ON p.perfume_id = mp.perfume_id
            """
            + DOMINANT_REGION_JOIN
            + """
            WHERE p.is_active = TRUE
            """;

    /** 경계에 걸친 향수는 포함합니다. 화면 가장자리의 점이 사라지면 지도를 옮길 때 깜박입니다. */
    private static final String VIEWPORT_FILTER = """
              AND mp.map_x BETWEEN :minX AND :maxX
              AND mp.map_y BETWEEN :minY AND :maxY
            """;

    private static final String ORDER_BY_PERFUME_ID = "ORDER BY p.perfume_id\n";

    private static final String SELECT_MAP_PERFUME = """
            SELECT p.perfume_id, p.name, p.name_ko, mp.map_x, mp.map_y,
                   dominant.scent_region_id,
                   (SELECT i.image_url
                    FROM perfume_images i
                    WHERE i.perfume_id = p.perfume_id
                    ORDER BY i.display_order NULLS LAST, i.image_id
                    LIMIT 1) AS image_url
            FROM perfume_map_points mp
            JOIN perfumes p ON p.perfume_id = mp.perfume_id
            """
            + DOMINANT_REGION_JOIN
            + """
            WHERE p.is_active = TRUE
              AND mp.perfume_id = :perfumeId
            """;

    private final JdbcClient jdbcClient;

    public ScentMapRepository(JdbcClient jdbcClient) {
        this.jdbcClient = jdbcClient;
    }

    public List<ScentRegionRow> findActiveRegions() {
        return jdbcClient.sql(SELECT_ACTIVE_REGIONS)
                .query((rs, rowNum) -> new ScentRegionRow(
                        rs.getLong("scent_region_id"),
                        rs.getString("code"),
                        rs.getString("name"),
                        rs.getObject("display_order", Integer.class),
                        rs.getObject("anchor_x", Double.class),
                        rs.getObject("anchor_y", Double.class),
                        rs.getString("polygon")
                ))
                .list();
    }

    /** 지도에 좌표가 있는 활성 향수 전체입니다. */
    public List<MapPerfumeResponse> findPerfumes() {
        return jdbcClient.sql(SELECT_MAP_PERFUMES + ORDER_BY_PERFUME_ID)
                .query(ScentMapRepository::toMapPerfume)
                .list();
    }

    /** 주어진 사각형 안(경계 포함)에 있는 활성 향수입니다. */
    public List<MapPerfumeResponse> findPerfumesIn(MapViewportCondition viewport) {
        return jdbcClient.sql(SELECT_MAP_PERFUMES + VIEWPORT_FILTER + ORDER_BY_PERFUME_ID)
                .params(Map.of(
                        "minX", viewport.minX(),
                        "maxX", viewport.maxX(),
                        "minY", viewport.minY(),
                        "maxY", viewport.maxY()
                ))
                .query(ScentMapRepository::toMapPerfume)
                .list();
    }

    /** 좌표가 없거나 비활성인 향수는 빈 {@link Optional} 입니다. */
    public Optional<MapPerfumeDetailResponse> findPerfume(Long perfumeId) {
        return jdbcClient.sql(SELECT_MAP_PERFUME)
                .param("perfumeId", perfumeId)
                .query((rs, rowNum) -> new MapPerfumeDetailResponse(
                        rs.getLong("perfume_id"),
                        rs.getString("name"),
                        rs.getString("name_ko"),
                        rs.getString("image_url"),
                        rs.getDouble("map_x"),
                        rs.getDouble("map_y"),
                        rs.getObject("scent_region_id", Long.class)
                ))
                .optional();
    }

    private static MapPerfumeResponse toMapPerfume(ResultSet rs, int rowNum) throws SQLException {
        return new MapPerfumeResponse(
                rs.getLong("perfume_id"),
                rs.getString("name"),
                rs.getDouble("map_x"),
                rs.getDouble("map_y"),
                rs.getObject("scent_region_id", Long.class)
        );
    }
}
