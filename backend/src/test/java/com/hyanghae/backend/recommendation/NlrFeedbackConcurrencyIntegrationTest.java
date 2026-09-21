package com.hyanghae.backend.recommendation;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.BDDMockito.given;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.hyanghae.backend.recommendation.client.NlrClient;
import com.hyanghae.backend.recommendation.client.NlrRecommendResponse;
import com.hyanghae.backend.support.IntegrationTest;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.Callable;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

/**
 * 같은 추천에 만족도가 동시에 들어올 때를 봅니다.
 *
 * <p>서비스가 <b>확인하고 넣습니다.</b> 그 사이에 다른 요청이 끼어들 수 있고, 그러면 둘 다
 * 확인을 통과해 둘 다 삽입을 시도합니다. 기본키가 두 번째를 막는데, 그 예외를 그대로 두면
 * 사용자가 <b>500</b> 을 받습니다. 실제로 일어난 일은 "이미 답했다" 이지 서버 오류가 아닙니다.
 *
 * <p>여기서 볼 것은 <b>두 경로가 같은 답을 내는가</b> 입니다. 먼저 확인에서 걸리든 기본키에서
 * 걸리든 화면에는 같은 409 가 나가야 하고, 표에는 한 줄만 남아야 합니다.
 *
 * <p>두 요청이 같은 순간에 출발하도록 관문으로 맞춥니다. 어느 쪽이 먼저 도착하는지는 그때그때
 * 다르지만 결과는 매번 같아야 합니다 — 타이밍에 기대지 않습니다.
 *
 * <p>화면을 다시 열거나 버튼을 두 번 누르면 실제로 일어납니다. 드문 일이라고 500 을 내보내면
 * 그 사람에게는 서버가 고장 난 것으로 보입니다.
 */
@IntegrationTest
@AutoConfigureMockMvc
class NlrFeedbackConcurrencyIntegrationTest {

    private static final String RECOMMEND_URL = "/api/v1/recommendations/natural-language";
    private static final String QUERY = "빨래 냄새 나는 향수 찾고 있어";

    /** 동시에 보낼 요청 수입니다. 둘이면 경합을 만들기에 충분하고 실행이 빠릅니다. */
    private static final int CONCURRENT_REQUESTS = 2;

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Autowired
    private StringRedisTemplate redisTemplate;

    @MockitoBean
    private NlrClient nlrClient;

    @BeforeEach
    void insertFixtures() {
        clearAll();
        jdbcTemplate.update("INSERT INTO brands (brand_id, name) VALUES (1, 'Test Brand')");
        jdbcTemplate.update("""
                INSERT INTO perfumes (perfume_id, brand_id, fragrantica_id, name, is_active)
                VALUES (1, 1, 73368, 'Laundry', TRUE)
                """);
        given(nlrClient.recommend(anyString())).willReturn(aiResponse());
    }

    @AfterEach
    void cleanUp() {
        clearAll();
    }

    /**
     * 동시에 두 번 답해도 한 줄만 남고 하나는 409 입니다.
     *
     * <p><b>500 이 하나라도 나오면 실패입니다.</b> 기본키 위반을 잡지 않으면 여기서 드러납니다.
     */
    @Test
    void keepsOneFeedbackUnderConcurrentAnswers() throws Exception {
        String token = recommend();

        List<Integer> statuses = inParallel(index -> feedbackStatusOf(token));

        assertThat(statuses).containsExactlyInAnyOrder(201, 409);
        assertThat(jdbcTemplate.queryForObject(
                "SELECT count(*) FROM nlr_feedbacks", Integer.class))
                .isEqualTo(1);
    }

    /**
     * 같은 카드를 동시에 눌러도 처음 시각 하나만 남습니다.
     *
     * <p>클릭은 {@code WHERE clicked_at IS NULL} 로 막습니다. 갱신 조건에 들어 있어 두 요청이
     * 겹쳐도 한쪽만 값을 씁니다 — 확인하고 쓰는 것이 아니라 <b>조건이 붙은 한 문장</b>이라
     * 경합할 틈이 없습니다.
     */
    @Test
    void keepsOneClickTimeUnderConcurrentClicks() throws Exception {
        String token = recommend();

        List<Integer> statuses = inParallel(index -> clickStatusOf(token));

        assertThat(statuses).containsOnly(204);
        assertThat(jdbcTemplate.queryForObject(
                "SELECT count(*) FROM nlr_recommendation_items"
                        + " WHERE clicked_at IS NOT NULL", Integer.class))
                .isEqualTo(1);
    }

    /**
     * 요청들을 같은 순간에 출발시킵니다.
     *
     * <p>관문을 쓰는 이유는 순서대로 부르면 경합이 안 생기기 때문입니다. 먼저 스레드를 다 세워
     * 두고 한 번에 풀어야 두 요청이 실제로 겹칩니다.
     */
    private List<Integer> inParallel(ThrowingFunction task) throws Exception {
        CountDownLatch gate = new CountDownLatch(1);
        ExecutorService pool = Executors.newFixedThreadPool(CONCURRENT_REQUESTS);

        try {
            List<Callable<Integer>> calls = new ArrayList<>();
            for (int index = 0; index < CONCURRENT_REQUESTS; index++) {
                int current = index;
                calls.add(() -> {
                    gate.await();
                    return task.apply(current);
                });
            }

            List<Future<Integer>> futures = new ArrayList<>();
            for (Callable<Integer> call : calls) {
                futures.add(pool.submit(call));
            }
            gate.countDown();

            List<Integer> statuses = new ArrayList<>();
            for (Future<Integer> future : futures) {
                statuses.add(future.get());
            }
            return statuses;
        } finally {
            pool.shutdownNow();
        }
    }

    private int feedbackStatusOf(String token) throws Exception {
        return mockMvc.perform(post(RECOMMEND_URL + "/" + token + "/feedback")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"satisfaction\":\"SATISFIED\"}"))
                .andReturn().getResponse().getStatus();
    }

    private int clickStatusOf(String token) throws Exception {
        return mockMvc.perform(post(RECOMMEND_URL + "/" + token + "/clicks")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"rank\":1}"))
                .andReturn().getResponse().getStatus();
    }

    private String recommend() throws Exception {
        clearRateLimit();
        String body = mockMvc.perform(post(RECOMMEND_URL)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"query\":\"" + QUERY + "\"}"))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        return body.replaceAll(".*\"recommendationToken\"\\s*:\\s*\"([0-9a-f-]+)\".*", "$1");
    }

    private static NlrRecommendResponse aiResponse() {
        return new NlrRecommendResponse(
                "OK",
                QUERY,
                "v1_15",
                "4f0a368d98b41338",
                new NlrRecommendResponse.Conditions(
                        List.of("soapy"), List.of(), List.of("빨래"), "lexicon_only"),
                List.of(),
                List.of(new NlrRecommendResponse.Result(73368L,
                        List.of(new NlrRecommendResponse.Matched("soapy", "빨래")))),
                List.of(),
                new NlrRecommendResponse.Diagnostics("AND", 1, 1, List.of(), null));
    }

    private void clearAll() {
        jdbcTemplate.update("DELETE FROM nlr_recommendations");
        jdbcTemplate.update("DELETE FROM perfumes");
        jdbcTemplate.update("DELETE FROM brands");
        clearRateLimit();
    }

    private void clearRateLimit() {
        redisTemplate.delete(redisTemplate.keys("recommendation:rate:*"));
    }

    /** 검사 예외를 던질 수 있는 작업입니다. {@code Function} 은 그것을 못 받습니다. */
    @FunctionalInterface
    private interface ThrowingFunction {
        int apply(int index) throws Exception;
    }
}
