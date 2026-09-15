package com.hyanghae.backend.taste.repository;

import java.sql.Array;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

/**
 * 취향 테스트 기록을 읽고 씁니다.
 *
 * <p>사용자당 한 줄입니다. {@code uk_user_taste_tests_user} 가 그것을 표에서 막습니다. 먼저
 * 조회해서 없으면 넣는 방식은 두 요청이 동시에 들어왔을 때 둘 다 통과합니다. 그래서 그냥 넣고
 * 제약에 걸리면 이미 마친 것으로 봅니다 — 배 자리 저장이 같은 이유로 {@code ON CONFLICT} 를
 * 씁니다.
 */
@Repository
public class TasteTestRepository {

    /**
     * 응시 한 줄을 넣습니다. 같은 회원이 두 번째로 넣으려 하면 유니크 제약에 걸립니다.
     *
     * <p>{@code completed_at} 을 애플리케이션이 만들지 않고 {@code NOW()} 로 둡니다. 인스턴스마다
     * 시계가 조금씩 달라 같은 순간의 기록이 뒤섞여 보입니다. 탐색 기록도 같은 방식입니다.
     */
    private static final String INSERT_TEST = """
            INSERT INTO user_taste_tests (user_id, matched_perfume_id, completed_at)
            VALUES (:userId, :matchedPerfumeId, NOW())
            RETURNING user_test_id, completed_at
            """;

    /** 고른 계열 한 줄입니다. {@code pickOrder} 는 1 또는 2 입니다. */
    private static final String INSERT_SELECTION = """
            INSERT INTO user_taste_test_selections (user_test_id, scent_region_id, pick_order)
            VALUES (:userTestId, :scentRegionId, :pickOrder)
            """;

    /**
     * 응시 기록과 고른 계열, 결과 향수의 좌표를 한 번에 읽습니다.
     *
     * <p>고른 계열을 {@code ARRAY} 부속 질의로 가져옵니다. 바깥 조인으로 붙이면 계열 수만큼 줄이
     * 늘어 좌표까지 두 번 읽게 됩니다. 부속 질의의 {@code ORDER BY} 가 순위 순서를 지킵니다.
     *
     * <p>지도 좌표는 바깥 조인입니다. 지도를 다시 만들면서 결과 향수가 빠지면
     * {@code matched_perfume_id} 가 {@code NULL} 이 되는데, 안쪽 조인으로 두면 그 회원의 응시
     * 기록 자체가 조회되지 않습니다.
     */
    private static final String SELECT_TEST = """
            SELECT t.matched_perfume_id,
                   t.completed_at,
                   mp.map_x,
                   mp.map_y,
                   ARRAY(
                       SELECT r.code
                       FROM user_taste_test_selections s
                       JOIN scent_regions r ON r.scent_region_id = s.scent_region_id
                       WHERE s.user_test_id = t.user_test_id
                       ORDER BY s.pick_order
                   ) AS picks
            FROM user_taste_tests t
            LEFT JOIN perfume_map_points mp ON mp.perfume_id = t.matched_perfume_id
            WHERE t.user_id = :userId
            """;

    /**
     * 계열 코드를 번호로 바꿉니다. 없는 코드는 결과에 나오지 않습니다.
     *
     * <p>내려간 계열은 뺍니다. 화면이 더 이상 내놓지 않는 계열을 새로 고를 수는 없습니다.
     */
    private static final String SELECT_SCENT_REGION_IDS = """
            SELECT code, scent_region_id
            FROM scent_regions
            WHERE code IN (:codes)
              AND is_active = TRUE
            """;

    private final JdbcClient jdbcClient;

    public TasteTestRepository(JdbcClient jdbcClient) {
        this.jdbcClient = jdbcClient;
    }

    /** 넣은 줄의 번호와 시각입니다. 유니크 제약에 걸리면 예외가 올라옵니다. */
    public InsertedTest insert(Long userId, Long matchedPerfumeId) {
        return jdbcClient.sql(INSERT_TEST)
                .param("userId", userId)
                .param("matchedPerfumeId", matchedPerfumeId)
                .query((rs, rowNum) -> new InsertedTest(
                        rs.getLong("user_test_id"),
                        rs.getObject("completed_at", OffsetDateTime.class)))
                .single();
    }

    /** 고른 계열을 순위 순서대로 넣습니다. 목록의 첫 번째가 1순위입니다. */
    public void insertSelections(Long userTestId, List<Long> scentRegionIds) {
        for (int i = 0; i < scentRegionIds.size(); i++) {
            jdbcClient.sql(INSERT_SELECTION)
                    .param("userTestId", userTestId)
                    .param("scentRegionId", scentRegionIds.get(i))
                    .param("pickOrder", i + 1)
                    .update();
        }
    }

    /** 아직 치르지 않은 사용자는 빈 {@link Optional} 입니다. */
    public Optional<TasteTestRow> find(Long userId) {
        return jdbcClient.sql(SELECT_TEST)
                .param("userId", userId)
                .query(TasteTestRepository::toRow)
                .optional();
    }

    /**
     * 코드를 넣은 순서 그대로 번호를 돌려줍니다. 하나라도 없는 코드가 있으면 그만큼 짧습니다.
     *
     * <p>순서를 지키는 것이 중요합니다. 목록의 자리가 곧 순위이기 때문입니다.
     */
    public List<Long> findScentRegionIds(List<String> codes) {
        Map<String, Long> byCode = new LinkedHashMap<>();
        jdbcClient.sql(SELECT_SCENT_REGION_IDS)
                .param("codes", codes)
                .query((rs, rowNum) -> Map.entry(
                        rs.getString("code"), rs.getLong("scent_region_id")))
                .list()
                .forEach(entry -> byCode.put(entry.getKey(), entry.getValue()));

        List<Long> ids = new ArrayList<>();
        for (String code : codes) {
            Long id = byCode.get(code);
            if (id != null) {
                ids.add(id);
            }
        }
        return ids;
    }

    private static TasteTestRow toRow(ResultSet rs, int rowNum) throws SQLException {
        return new TasteTestRow(
                toPicks(rs.getArray("picks")),
                rs.getObject("matched_perfume_id", Long.class),
                rs.getObject("map_x", Double.class),
                rs.getObject("map_y", Double.class),
                rs.getObject("completed_at", OffsetDateTime.class)
        );
    }

    /**
     * 계열 코드 배열을 목록으로 옮깁니다. 순서가 곧 순위입니다.
     *
     * <p>{@code Object[]} 로 받습니다. {@link Array#getArray()} 가 무엇을 돌려줄지는
     * 드라이버가 정합니다 — 지금 쓰는 PostgreSQL 드라이버는 {@code String[]} 을 주지만 그것은
     * 계약이 아닙니다. {@code String[]} 로 바로 받으면 드라이버나 열 타입이 바뀌는 날
     * {@code ClassCastException} 이 납니다. 배열 통째로가 아니라 원소를 하나씩 옮기면 그 사정과
     * 무관해집니다.
     */
    private static List<String> toPicks(Array array) throws SQLException {
        Object[] codes = (Object[]) array.getArray();
        List<String> picks = new ArrayList<>(codes.length);
        for (Object code : codes) {
            picks.add((String) code);
        }
        return List.copyOf(picks);
    }

    /** 방금 넣은 응시 줄입니다. 고른 계열을 이어 넣을 때 번호가 필요합니다. */
    public record InsertedTest(Long userTestId, OffsetDateTime completedAt) {
    }
}
