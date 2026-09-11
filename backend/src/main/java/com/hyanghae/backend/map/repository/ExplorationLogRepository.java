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
     * 향수를 고른 이동입니다. 좌표를 값으로 받지 않고 향수 좌표에서 가져옵니다.
     *
     * <p>{@code INSERT ... SELECT} 라 지도에 없는 향수는 고를 행이 없어 아무것도 들어가지
     * 않습니다. 향수를 먼저 조회해 확인하고 넣는 방법도 있지만, 그 사이에 향수가 비활성으로
     * 바뀌면 확인과 적재가 어긋납니다. 한 문장으로 두면 그 틈이 없습니다.
     *
     * <p>{@code visited_at} 을 값으로 주지 않습니다. 표의 기본값이 {@code NOW()} 이고, 넣은
     * 시각을 {@code RETURNING} 으로 돌려받아 응답에 씁니다. 애플리케이션이 만든 시각을 쓰면
     * 인스턴스마다 시계가 조금씩 달라 같은 순간의 기록이 뒤섞여 보입니다.
     */
    private static final String INSERT_PERFUME_VISIT = """
            INSERT INTO map_exploration_logs (user_id, perfume_id, x_coordinate, y_coordinate)
            SELECT :userId, mp.perfume_id, mp.map_x, mp.map_y
            FROM perfume_map_points mp
            JOIN perfumes p ON p.perfume_id = mp.perfume_id
            WHERE mp.perfume_id = :perfumeId
              AND p.is_active = TRUE
            RETURNING log_id, visited_at
            """;

    /** 빈 바다로 간 이동입니다. 가리키는 향수가 없어 {@code perfume_id} 가 비어 있습니다. */
    private static final String INSERT_SEA_MOVE = """
            INSERT INTO map_exploration_logs (user_id, perfume_id, x_coordinate, y_coordinate)
            VALUES (:userId, NULL, :x, :y)
            RETURNING log_id, visited_at
            """;

    /**
     * 배가 마지막으로 남긴 자리입니다.
     *
     * <p>빈 바다 클릭이 향 영역을 바꿨는지 판단할 때 기준이 됩니다. 기록은 향수를 고르거나 영역이
     * 바뀐 순간에만 남으므로, 마지막 기록의 자리가 곧 배가 있던 영역입니다.
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

    /** 지도에 없는 향수라 기록할 자리가 없으면 빈 {@link Optional} 입니다. */
    public Optional<ExplorationLogCreateResponse> insertPerfumeVisit(Long userId, Long perfumeId) {
        return jdbcClient.sql(INSERT_PERFUME_VISIT)
                .param("userId", userId)
                .param("perfumeId", perfumeId)
                .query(ExplorationLogRepository::toCreatedLog)
                .optional();
    }

    public ExplorationLogCreateResponse insertSeaMove(Long userId, double x, double y) {
        return jdbcClient.sql(INSERT_SEA_MOVE)
                .param("userId", userId)
                .param("x", x)
                .param("y", y)
                .query(ExplorationLogRepository::toCreatedLog)
                .single();
    }

    /** 기록이 하나도 없는 사용자는 빈 {@link Optional} 입니다. */
    public Optional<ExplorationPoint> findLastPoint(Long userId) {
        return jdbcClient.sql(SELECT_LAST_POINT)
                .param("userId", userId)
                .query((rs, rowNum) -> new ExplorationPoint(
                        rs.getDouble("x_coordinate"),
                        rs.getDouble("y_coordinate")
                ))
                .optional();
    }

    private static ExplorationLogCreateResponse toCreatedLog(ResultSet rs, int rowNum)
            throws SQLException {
        return new ExplorationLogCreateResponse(
                rs.getLong("log_id"),
                rs.getObject("visited_at", OffsetDateTime.class)
        );
    }
}
