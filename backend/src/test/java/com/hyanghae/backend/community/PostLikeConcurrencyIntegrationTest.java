package com.hyanghae.backend.community;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;

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
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

/**
 * 좋아요와 조회수가 동시에 들어와도 수가 어긋나지 않는지 검증합니다.
 *
 * <p>두 값은 여러 사람이 같은 순간에 건드리는 자리라 한 번에 하나씩 올 때는 드러나지 않는 문제가
 * 있습니다. 좋아요는 <b>확인하고 넣는 사이</b>에 다른 요청이 끼어들면 같은 사람의 좋아요가 두 줄이
 * 되고, 조회수는 <b>읽고 더해 저장하면</b> 두 요청이 같은 값을 읽어 한 번이 사라집니다.
 *
 * <p>두 요청이 같은 순간에 출발하도록 관문으로 맞춥니다. 어느 쪽이 먼저 도착하는지는 그때그때
 * 다르지만, 결과는 매번 같아야 합니다. 그래서 타이밍에 기대지 않습니다.
 *
 * <p>{@link FakeCurrentUser} 가 여기서는 스레드마다 다른 사람을 봅니다. 여러 사람이 동시에 누르는
 * 상황을 만들려면 스레드마다 로그인한 사람이 달라야 하는데, 필드 하나로 두면 스레드끼리 서로의
 * 값을 덮어씁니다.
 *
 * <p>수는 응답이 아니라 <b>표에서 다시 읽어</b> 확인합니다. 동시에 달린 요청은 각자 자기 트랜잭션이
 * 본 값을 돌려주므로, 응답의 수는 최종 결과보다 작을 수 있습니다. 그것은 오류가 아닙니다.
 */
@IntegrationTest
@AutoConfigureMockMvc
@ActiveProfiles({"manual-test", "test"})
class PostLikeConcurrencyIntegrationTest {

    private static final String POST_URL = "/api/v1/posts/{postId}";
    private static final String LIKE_URL = "/api/v1/posts/{postId}/like";

    private static final long POST_ID = 1;

    /** 동시에 달릴 요청 수입니다. 커넥션 풀(기본 10)보다 작게 잡습니다. */
    private static final int CONCURRENT = 8;

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Autowired
    private FakeCurrentUser currentUser;

    @BeforeEach
    void insertFixtures() {
        clearData();

        for (int id = 1; id <= CONCURRENT; id++) {
            jdbcTemplate.update("""
                    INSERT INTO users (user_id, email, password_hash, nickname)
                    VALUES (?, ?, 'x', ?)
                    """, id, "user" + id + "@hyanghae.test", "사람" + id);
        }

        jdbcTemplate.update("""
                INSERT INTO posts (post_id, user_id, category_id, title, content,
                                   created_at, updated_at)
                VALUES (?, 1, (SELECT category_id FROM post_categories WHERE code = 'CHAT'),
                        '경합 대상 글', '본문', NOW(), NOW())
                """, POST_ID);
    }

    @AfterEach
    void cleanUp() {
        currentUser.logout();
        clearData();
    }

    /**
     * 같은 사람이 동시에 여러 번 눌러도 좋아요는 하나입니다.
     *
     * <p>먼저 확인하고 없으면 넣는 식으로 썼다면, 여덟 요청이 모두 "없음" 을 보고 모두 넣으려 해
     * 일곱이 기본키 충돌로 500 을 받습니다. {@code ON CONFLICT DO NOTHING} 은 확인과 삽입을 한
     * 문장으로 처리해 그 틈이 없습니다.
     *
     * <p>여덟 요청이 모두 200 이어야 합니다. 이미 눌린 상태를 만들어 달라는 요청이고, 그 상태는
     * 이루어져 있으니 오류가 아닙니다.
     */
    @Test
    void keepsOneLikeWhenTheSamePersonPressesConcurrently() throws Exception {
        List<Integer> statuses = runTogether(CONCURRENT, index -> likeStatusOf(1L));

        assertThat(statuses).containsOnly(200);
        assertThat(countRows("post_likes")).isEqualTo(1);
        assertThat(likeCountOf(POST_ID)).isEqualTo(1);
    }

    /**
     * 서로 다른 사람이 동시에 누르면 그 수만큼 쌓입니다.
     *
     * <p>앞 테스트가 "중복이 안 생긴다" 를 본다면 이쪽은 <b>"막아야 할 것만 막는다"</b> 를 봅니다.
     * 기본키를 잘못 잡아 사람을 구분하지 못하면 여덟 명이 눌러도 하나만 남습니다.
     */
    @Test
    void countsEveryPersonWhenDifferentPeoplePressConcurrently() throws Exception {
        List<Integer> statuses = runTogether(CONCURRENT, index -> likeStatusOf((long) index + 1));

        assertThat(statuses).containsOnly(200);
        assertThat(countRows("post_likes")).isEqualTo(CONCURRENT);
        assertThat(likeCountOf(POST_ID)).isEqualTo(CONCURRENT);
    }

    /**
     * 동시에 열어도 조회수가 열린 수만큼 오릅니다.
     *
     * <p>읽어서 더하고 저장하면 여덟 요청이 모두 0 을 읽어 모두 1 을 쓰고, 조회수가 1 이 됩니다.
     * {@code UPDATE posts SET view_count = view_count + 1} 은 표가 직접 더해 그런 틈이 없습니다.
     *
     * <p>비로그인으로 부릅니다. 조회수는 누가 보든 오르는 값이라 로그인 여부와 무관합니다.
     */
    @Test
    void countsEveryViewWhenOpenedConcurrently() throws Exception {
        List<Integer> statuses = runTogether(CONCURRENT, index -> viewStatusOf(POST_ID));

        assertThat(statuses).containsOnly(200);
        assertThat(viewCountOf(POST_ID)).isEqualTo(CONCURRENT);
    }

    /**
     * 좋아요와 조회가 섞여 들어와도 서로를 밀어내지 않습니다.
     *
     * <p>둘은 같은 글의 다른 자리를 건드립니다. 조회수는 {@code posts} 의 행을 잠그고 좋아요는
     * {@code post_likes} 에 행을 넣는데, 둘을 한 자리에 몰아넣었다면 서로를 기다리다 수가 어긋납니다.
     */
    @Test
    void keepsBothCountsWhenLikesAndViewsInterleave() throws Exception {
        List<Integer> statuses = runTogether(CONCURRENT, index -> index % 2 == 0
                ? likeStatusOf((long) index + 1)
                : viewStatusOf(POST_ID));

        assertThat(statuses).containsOnly(200);
        assertThat(likeCountOf(POST_ID)).isEqualTo(CONCURRENT / 2);
        assertThat(viewCountOf(POST_ID)).isEqualTo(CONCURRENT / 2);
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

    /** 이 스레드에서 {@code userId} 로 로그인해 좋아요를 누릅니다. */
    private int likeStatusOf(Long userId) throws Exception {
        currentUser.login(userId);
        return mockMvc.perform(put(LIKE_URL, POST_ID))
                .andReturn()
                .getResponse()
                .getStatus();
    }

    /** 비로그인으로 상세를 엽니다. */
    private int viewStatusOf(long postId) throws Exception {
        currentUser.logout();
        return mockMvc.perform(get(POST_URL, postId))
                .andReturn()
                .getResponse()
                .getStatus();
    }

    /**
     * 두 수 모두 표에서 바로 읽습니다.
     *
     * <p>상세 API 로 읽으면 <b>읽는 행위가 조회수를 하나 올려</b> 검증하려던 수가 달라집니다.
     * 상세 조회가 상태를 바꾸기 때문에 생기는 일입니다. 응답에 실리는 값이 맞는지는
     * {@code PostIntegrationTest} 가 봅니다.
     */
    private long likeCountOf(long postId) {
        return jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM post_likes WHERE post_id = ?", Long.class, postId);
    }

    private long viewCountOf(long postId) {
        return jdbcTemplate.queryForObject(
                "SELECT view_count FROM posts WHERE post_id = ?", Long.class, postId);
    }

    private long countRows(String table) {
        return jdbcTemplate.queryForObject("SELECT COUNT(*) FROM " + table, Long.class);
    }

    private void clearData() {
        jdbcTemplate.update("DELETE FROM post_likes");
        jdbcTemplate.update("DELETE FROM comments");
        jdbcTemplate.update("DELETE FROM post_images");
        jdbcTemplate.update("DELETE FROM post_perfumes");
        jdbcTemplate.update("DELETE FROM posts");
        jdbcTemplate.update("DELETE FROM users");
    }

    @FunctionalInterface
    private interface ThrowingIntFunction {
        int apply(int index) throws Exception;
    }

    @TestConfiguration
    static class FakeCurrentUserConfig {

        @Bean
        @Primary
        FakeCurrentUser fakeCurrentUser() {
            return new FakeCurrentUser();
        }
    }

    /**
     * 스레드마다 다른 사람을 봅니다.
     *
     * <p>다른 통합 테스트의 대역은 필드 하나로 충분하지만, 여기서는 여러 사람이 동시에 누르는
     * 상황을 만들어야 합니다. 필드 하나면 스레드끼리 서로의 값을 덮어써서 누가 눌렀는지가
     * 뒤섞입니다.
     */
    static class FakeCurrentUser implements CurrentUser {

        private final ThreadLocal<Long> id = new ThreadLocal<>();

        void login(Long id) {
            this.id.set(id);
        }

        void logout() {
            this.id.remove();
        }

        @Override
        public Optional<Long> id() {
            return Optional.ofNullable(id.get());
        }
    }
}
