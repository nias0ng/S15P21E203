package com.hyanghae.backend.map.repository;

import com.hyanghae.backend.map.dto.response.ExplorationLogCreateResponse;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.OffsetDateTime;
import java.util.Optional;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

/**
 * 향 지도 탐색 기록을 씁니다.
 *
 * <p>향 지도 도메인의 다른 조회와 같이 SQL 을 직접 씁니다. 엔티티를 두지 않는 이유는 이 표에
 * 하는 일이 한 줄 넣기와 마지막 한 줄 읽기뿐이기 때문입니다.
 */
@Repository
public class ExplorationLogRepository {

    /**
     * 배가 옮겨 간 향수의 지도 좌표입니다.
     *
     * <p>지도에 없는 향수는 비어 있습니다. 좌표가 없거나 비활성인 향수로는 배를 옮길 수 없습니다.
     */
    private static final String SELECT_MAP_POINT = """
            SELECT mp.map_x, mp.map_y
            FROM perfume_map_points mp
            JOIN perfumes p ON p.perfume_id = mp.perfume_id
            WHERE mp.perfume_id = :perfumeId
              AND p.is_active = TRUE
            """;

    /**
     * 기록 한 줄을 넣습니다. 빈 바다로 간 이동은 {@code perfumeId} 가 {@code null} 입니다.
     *
     * <p>{@code visited_at} 을 값으로 주지 않습니다. 표의 기본값이 {@code NOW()} 이고, 넣은
     * 시각을 {@code RETURNING} 으로 돌려받아 응답에 씁니다. 애플리케이션이 만든 시각을 쓰면
     * 인스턴스마다 시계가 조금씩 달라 같은 순간의 기록이 뒤섞여 보입니다.
     */
    private static final String INSERT_LOG = """
            INSERT INTO map_exploration_logs (user_id, perfume_id, x_coordinate, y_coordinate)
            VALUES (:userId, :perfumeId, :x, :y)
            RETURNING log_id, visited_at
            """;

    /**
     * 배가 마지막으로 남긴 자리입니다.
     *
     * <p>빈 바다 클릭이 향 영역을 바꿨는지 판단할 때 기준이 됩니다. 기록은 향수를 고르거나 영역이
     * 바뀐 순간에만 남으므로, 마지막 기록의 자리가 곧 배가 있던 영역입니다. 배의 정확한 현재
     * 위치는 {@code map_exploration_states} 가 따로 들고 있습니다.
     *
     * <p>같은 시각의 기록이 있을 수 있어 {@code log_id} 로 순서를 확정합니다. 시각만으로 정렬하면
     * 어느 줄이 마지막인지 실행마다 달라질 수 있습니다.
     */
    private static final String SELECT_LAST_POINT = """
            SELECT x_coordinate, y_coordinate
            FROM map_exploration_logs
            WHERE user_id = :userId
            ORDER BY visited_at DESC, log_id DESC
            LIMIT 1
            """;

    private final JdbcClient jdbcClient;

    public ExplorationLogRepository(JdbcClient jdbcClient) {
        this.jdbcClient = jdbcClient;
    }

    /** 지도에 없는 향수는 빈 {@link Optional} 입니다. */
    public Optional<ExplorationPoint> findMapPoint(Long perfumeId) {
        return jdbcClient.sql(SELECT_MAP_POINT)
                .param("perfumeId", perfumeId)
                .query(ExplorationLogRepository::toPoint)
                .optional();
    }

    public ExplorationLogCreateResponse insert(
            Long userId,
            Long perfumeId,
            ExplorationPoint point
    ) {
        return jdbcClient.sql(INSERT_LOG)
                .param("userId", userId)
                .param("perfumeId", perfumeId)
                .param("x", point.x())
                .param("y", point.y())
                .query((rs, rowNum) -> new ExplorationLogCreateResponse(
                        rs.getLong("log_id"),
                        rs.getObject("visited_at", OffsetDateTime.class)
                ))
                .single();
    }

    /** 기록이 하나도 없는 사용자는 빈 {@link Optional} 입니다. */
    public Optional<ExplorationPoint> findLastPoint(Long userId) {
        return jdbcClient.sql(SELECT_LAST_POINT)
                .param("userId", userId)
                .query(ExplorationLogRepository::toPoint)
                .optional();
    }

    private static ExplorationPoint toPoint(ResultSet rs, int rowNum) throws SQLException {
        return new ExplorationPoint(rs.getDouble(1), rs.getDouble(2));
    }
}
