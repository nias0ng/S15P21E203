package com.hyanghae.backend.taste;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;

import com.hyanghae.backend.global.security.CurrentUser;
import com.hyanghae.backend.support.IntegrationTest;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.concurrent.Callable;
import java.util.concurrent.CyclicBarrier;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Primary;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;

/**
 * 같은 회원의 응시가 같은 순간에 여러 번 들어와도 한 번만 남는지 검증합니다.
 *
 * <p>한 번에 하나씩 올 때는 드러나지 않는 자리입니다. 먼저 조회해서 없으면 넣는 방식이었다면 두
 * 요청이 모두 "아직 안 했다" 를 보고 지나가 응시가 두 줄이 됩니다. 여기서는 그냥 넣고
 * {@code uk_user_taste_tests_user} 에 걸리는 쪽을 409 로 돌립니다.
 *
 * <p><b>배 자리까지 봅니다.</b> 저장과 배 띄우기가 한 트랜잭션이라, 진 요청이 띄운 배는 되돌아가야
 * 합니다. 되돌아가지 않으면 409 로 거절해 놓고 배는 진 쪽 향수에 떠 있게 됩니다. 스레드마다 결과
 * 향수를 다르게 주는 이유가 이것입니다 — 같은 향수로 두면 어느 쪽이 남았는지 구분할 수 없습니다.
 *
 * <p>요청이 같은 순간에 출발하도록 관문으로 맞춥니다. 어느 쪽이 먼저 도착하는지는 그때그때
 * 다르지만 결과는 매번 같아야 합니다. 그래서 타이밍에 기대지 않습니다.
 *
 * <p>여기서는 {@link FakeUser} 를 스레드마다 나눌 필요가 없습니다. 여러 사람이 아니라 <b>한
 * 사람이</b> 동시에 여러 번 보내는 상황이라 모든 스레드가 같은 회원입니다.
 */
@IntegrationTest
@AutoConfigureMockMvc
class TasteTestConcurrencyIntegrationTest {

    private static final String URL = "/api/v1/users/me/taste-test";

    private static final long USER_ID = 1;

    /** 동시에 달릴 요청 수입니다. 커넥션 풀(기본 10)보다 작게 잡습니다. */
    private static final int CONCURRENT = 4;

    /** 스레드마다 다른 결과 향수를 보냅니다. 번호가 곧 지도 좌표입니다. */
    private static final long FIRST_PERFUME = 1;

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Autowired
    private FakeUser currentUser;

    @BeforeEach
    void insertFixtures() {
        clearData();
        currentUser.id = USER_ID;

        jdbcTemplate.update(
                "INSERT INTO users (user_id, email, password_hash, nickname) VALUES (?, ?, 'x', ?)",
                USER_ID, "sailor@hyanghae.com", "항해자");
        jdbcTemplate.update(
                "INSERT INTO brands (brand_id, name, is_active) VALUES (1, 'Chanel', TRUE)");

        for (int index = 0; index < CONCURRENT; index++) {
            long perfumeId = FIRST_PERFUME + index;
            jdbcTemplate.update("""
                    INSERT INTO perfumes (perfume_id, name, brand_id, is_active)
                    VALUES (?, ?, 1, TRUE)
                    """, perfumeId, "Scent " + perfumeId);
            jdbcTemplate.update(
                    "INSERT INTO perfume_map_points (perfume_id, map_x, map_y) VALUES (?, ?, ?)",
                    perfumeId, coordinateOf(perfumeId), coordinateOf(perfumeId));
        }
    }

    @AfterEach
    void cleanUp() {
        clearData();
    }

    /**
     * 네 요청이 같은 순간에 들어와도 <b>하나만 201 이고 나머지는 모두 409</b> 입니다.
     *
     * <p>응시는 한 줄, 고른 계열은 그 한 줄의 것만 남습니다. 배는 성공한 요청이 보낸 향수 자리에
     * 있어야 합니다 — 진 요청들이 띄운 배가 남아 있으면 거절과 결과가 어긋납니다.
     */
    @Test
    void letsOnlyOneAttemptThrough() throws Exception {
        List<Integer> statuses = runTogether(
                CONCURRENT, index -> completeStatus(FIRST_PERFUME + index));

        assertThat(statuses).filteredOn(status -> status == 201).hasSize(1);
        assertThat(statuses).filteredOn(status -> status == 409).hasSize(CONCURRENT - 1);

        Integer tests = jdbcTemplate.queryForObject(
                "SELECT count(*) FROM user_taste_tests WHERE user_id = ?", Integer.class, USER_ID);
        assertThat(tests).isOne();

        Integer selections = jdbcTemplate.queryForObject(
                "SELECT count(*) FROM user_taste_test_selections", Integer.class);
        assertThat(selections).isOne();

        // 진 요청들이 적은 일지도 함께 되돌아가야 합니다. 남아 있으면 가 본 적 없는 구역이
        // 항해의 시작으로 여러 줄 적힙니다.
        Integer logs = jdbcTemplate.queryForObject(
                "SELECT count(*) FROM map_exploration_logs WHERE user_id = ?",
                Integer.class, USER_ID);
        assertThat(logs).isOne();

        Long winner = jdbcTemplate.queryForObject(
                "SELECT matched_perfume_id FROM user_taste_tests WHERE user_id = ?",
                Long.class, USER_ID);
        Double shipX = jdbcTemplate.queryForObject(
                "SELECT exploration_x FROM map_exploration_states WHERE user_id = ?",
                Double.class, USER_ID);
        assertThat(shipX).isEqualTo(coordinateOf(winner));
    }

    // ────────────────────────────────────────────────────────────────
    // 도우미
    // ────────────────────────────────────────────────────────────────

    /** 요청 {@code count} 개를 같은 순간에 출발시키고 상태 코드를 모읍니다. */
    private List<Integer> runTogether(int count, ThrowingIntFunction task) throws Exception {
        CyclicBarrier gate = new CyclicBarrier(count);
        ExecutorService pool = Executors.newFixedThreadPool(count);

        try {
            List<Callable<Integer>> calls = new ArrayList<>();
            for (int index = 0; index < count; index++) {
                int current = index;
                calls.add(() -> {
                    gate.await();
                    return task.apply(current);
                });
            }

            List<Integer> statuses = new ArrayList<>();
            for (Future<Integer> future : pool.invokeAll(calls)) {
                statuses.add(future.get());
            }
            return statuses;
        } finally {
            pool.shutdownNow();
        }
    }

    private int completeStatus(long perfumeId) throws Exception {
        String body = "{\"picks\": [\"FLORAL\"], \"matchedPerfumeId\": %d}".formatted(perfumeId);
        return mockMvc.perform(post(URL).contentType(MediaType.APPLICATION_JSON).content(body))
                .andReturn()
                .getResponse()
                .getStatus();
    }

    /** 향수마다 다른 좌표를 줍니다. 배가 어느 향수 자리에 떴는지 좌표만 보고 알 수 있습니다. */
    private static double coordinateOf(long perfumeId) {
        return perfumeId / 10.0;
    }

    private void clearData() {
        jdbcTemplate.update("DELETE FROM user_taste_test_selections");
        jdbcTemplate.update("DELETE FROM user_taste_tests");
        jdbcTemplate.update("DELETE FROM map_exploration_states");
        jdbcTemplate.update("DELETE FROM map_exploration_logs");
        jdbcTemplate.update("DELETE FROM perfume_map_points");
        jdbcTemplate.update("DELETE FROM perfumes");
        jdbcTemplate.update("DELETE FROM brands");
        jdbcTemplate.update("DELETE FROM users");
    }

    @FunctionalInterface
    interface ThrowingIntFunction {

        int apply(int index) throws Exception;
    }

    @TestConfiguration
    static class Config {

        @Bean
        @Primary
        FakeUser fakeUser() {
            return new FakeUser();
        }
    }

    /** 인증이 아직 없어 원하는 사용자 번호를 돌려주는 가짜를 넣습니다. */
    static class FakeUser implements CurrentUser {

        volatile Long id;

        @Override
        public Optional<Long> id() {
            return Optional.ofNullable(id);
        }
    }
}
