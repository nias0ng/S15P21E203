package com.hyanghae.backend.map.repository;

import com.hyanghae.backend.map.dto.response.ExplorationStateResponse;
import java.time.OffsetDateTime;
import java.util.Optional;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

/**
 * 배가 떠 있는 자리를 사용자당 한 줄로 들고 있습니다.
 *
 * <p>탐색 기록({@code map_exploration_logs})과 나뉘어 있는 이유가 있습니다. 기록은 일지에 적을
 * 사건만 남기므로 같은 향 영역 안에서 움직인 마지막 자리가 빠집니다. 그것으로 배를 되돌리면
 * 사용자가 마지막에 있던 곳이 아니라 그 영역에 처음 들어간 자리로 갑니다.
 */
@Repository
public class ExplorationStateRepository {

    /**
     * 있으면 덮어쓰고 없으면 넣습니다.
     *
     * <p>{@code user_id} 가 기본키라 {@code ON CONFLICT} 한 문장으로 끝납니다. 조회해서 있으면
     * 수정하고 없으면 넣는 방식은 두 요청이 동시에 들어오면 한쪽이 기본키 충돌로 실패합니다.
     *
     * <p>{@code created_at} 은 처음 넣을 때만 채우고 이후 갱신에서는 건드리지 않습니다. 배를
     * 처음 띄운 시각이라 덮어쓰면 의미가 사라집니다.
     */
    private static final String UPSERT_STATE = """
            INSERT INTO map_exploration_states
                (user_id, exploration_x, exploration_y, created_at, updated_at)
            VALUES (:userId, :x, :y, NOW(), NOW())
            ON CONFLICT (user_id) DO UPDATE
            SET exploration_x = EXCLUDED.exploration_x,
                exploration_y = EXCLUDED.exploration_y,
                updated_at = EXCLUDED.updated_at
            """;

    private static final String SELECT_STATE = """
            SELECT exploration_x, exploration_y, updated_at
            FROM map_exploration_states
            WHERE user_id = :userId
            """;

    private final JdbcClient jdbcClient;

    public ExplorationStateRepository(JdbcClient jdbcClient) {
        this.jdbcClient = jdbcClient;
    }

    public void save(Long userId, ExplorationPoint point) {
        jdbcClient.sql(UPSERT_STATE)
                .param("userId", userId)
                .param("x", point.x())
                .param("y", point.y())
                .update();
    }

    /** 한 번도 움직인 적이 없는 사용자는 빈 {@link Optional} 입니다. */
    public Optional<ExplorationStateResponse> find(Long userId) {
        return jdbcClient.sql(SELECT_STATE)
                .param("userId", userId)
                .query((rs, rowNum) -> new ExplorationStateResponse(
                        rs.getObject("exploration_x", Double.class),
                        rs.getObject("exploration_y", Double.class),
                        rs.getObject("updated_at", OffsetDateTime.class)
                ))
                .optional();
    }
}
