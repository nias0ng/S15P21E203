package com.hyanghae.backend.recommendation;

import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.hyanghae.backend.global.security.CurrentUser;
import com.hyanghae.backend.recommendation.client.NlrClient;
import com.hyanghae.backend.recommendation.client.NlrRecommendResponse;
import com.hyanghae.backend.support.IntegrationTest;
import java.util.List;
import java.util.UUID;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.context.annotation.Primary;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

/**
 * 자연어 추천의 호출량 제한을 실제 Redis 위에서 검증합니다.
 *
 * <p>추천 한 번이 AI 서버의 LLM 호출로 이어져 비용이 나갑니다. AI 서버는 외부에 열려 있지
 * 않고 스스로를 지키지 않으므로 <b>여기서 막지 않으면 막는 곳이 없습니다.</b>
 *
 * <p>Redis 를 대역으로 바꾸지 않습니다. 세는 일이 Lua 스크립트 안에서 일어나고, 그 스크립트가
 * 맞는지는 실제 Redis 에서만 확인됩니다. {@code @IntegrationTest} 가 Testcontainers 로 이미
 * 띄워 둡니다.
 *
 * <p>기본 한도는 비회원 10회·회원 30회이고 구간은 1분입니다. 테스트가 설정을 바꾸지 않고
 * 기본값을 그대로 씁니다 — 기본값이 바뀌면 여기서 드러나야 합니다.
 */
@IntegrationTest
@AutoConfigureMockMvc
@Import(RecommendationRateLimitIntegrationTest.FakeCurrentUserConfig.class)
class RecommendationRateLimitIntegrationTest {

    private static final String RECOMMEND_URL = "/api/v1/recommendations/natural-language";
    private static final String QUERY = "빨래 냄새 나는 향수 찾고 있어";

    private static final int ANONYMOUS_LIMIT = 10;
    private static final int MEMBER_LIMIT = 30;

    /** 클릭·만족도의 비회원 한도입니다. 추천보다 넉넉합니다 — 한 번의 추천이 여러 클릭을 부릅니다. */
    private static final int FEEDBACK_ANONYMOUS_LIMIT = 60;
    private static final long USER_ID = 7;

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private StringRedisTemplate redisTemplate;

    @Autowired
    private FakeCurrentUser currentUser;

    @MockitoBean
    private NlrClient nlrClient;

    @BeforeEach
    void reset() {
        redisTemplate.delete(redisTemplate.keys("recommendation:rate:*"));
        currentUser.logout();
        given(nlrClient.recommend(anyString()))
                .willReturn(new NlrRecommendResponse(
                        "NO_CONDITION", QUERY, null, List.of(), null, null));
    }

    /** 한도 안에서는 그대로 통과합니다. */
    @Test
    void allowsCallsWithinTheLimit() throws Exception {
        for (int attempt = 0; attempt < ANONYMOUS_LIMIT; attempt++) {
            mockMvc.perform(request()).andExpect(status().isOk());
        }
    }

    /**
     * 한도를 넘으면 429 입니다. 공통 에러 형식을 씁니다.
     *
     * <p>막힌 요청은 <b>AI 서버까지 가지 않아야</b> 합니다. 가면 막는 의미가 없습니다.
     */
    @Test
    void rejectsCallOverTheLimit() throws Exception {
        for (int attempt = 0; attempt < ANONYMOUS_LIMIT; attempt++) {
            mockMvc.perform(request()).andExpect(status().isOk());
        }

        mockMvc.perform(request())
                .andExpect(status().isTooManyRequests())
                .andExpect(jsonPath("$.code").value("RECOMMENDATION_RATE_LIMIT_EXCEEDED"))
                .andExpect(jsonPath("$.message").exists());

        verify(nlrClient, times(ANONYMOUS_LIMIT)).recommend(QUERY);
    }

    /**
     * 회원은 비회원보다 많이 부를 수 있습니다.
     *
     * <p>계약서가 "비회원도 호출할 수 있고 <b>차이는 호출량 제한뿐</b>" 이라고 정했습니다.
     * 결과는 같고 한도만 다릅니다.
     */
    @Test
    void givesMemberHigherLimitThanAnonymous() throws Exception {
        currentUser.login(USER_ID);

        for (int attempt = 0; attempt < ANONYMOUS_LIMIT + 1; attempt++) {
            mockMvc.perform(request()).andExpect(status().isOk());
        }
    }

    /** 회원도 자기 한도를 넘으면 429 입니다. */
    @Test
    void rejectsMemberOverTheirOwnLimit() throws Exception {
        currentUser.login(USER_ID);

        for (int attempt = 0; attempt < MEMBER_LIMIT; attempt++) {
            mockMvc.perform(request()).andExpect(status().isOk());
        }

        mockMvc.perform(request())
                .andExpect(status().isTooManyRequests())
                .andExpect(jsonPath("$.code").value("RECOMMENDATION_RATE_LIMIT_EXCEEDED"));
    }

    /**
     * 회원의 셈과 비회원의 셈이 섞이지 않습니다.
     *
     * <p>섞이면 한 사람이 한도를 다 써서 같은 IP 의 다른 사람을 막게 됩니다. 로그인하면
     * 사용자 번호로, 아니면 IP 로 세기 때문에 열쇠가 다릅니다.
     */
    @Test
    void countsMemberAndAnonymousSeparately() throws Exception {
        for (int attempt = 0; attempt < ANONYMOUS_LIMIT; attempt++) {
            mockMvc.perform(request()).andExpect(status().isOk());
        }
        mockMvc.perform(request()).andExpect(status().isTooManyRequests());

        currentUser.login(USER_ID);

        mockMvc.perform(request()).andExpect(status().isOk());
    }

    /**
     * 구간에 만료가 걸립니다.
     *
     * <p>{@code INCR} 뒤에 만료를 못 걸면 <b>만료 시각이 없는 키</b>가 남아 그 사용자가 영원히
     * 막힙니다. 시간이 지나기를 기다리는 대신 남은 만료 시각을 봅니다.
     */
    @Test
    void setsExpiryOnTheWindow() throws Exception {
        mockMvc.perform(request()).andExpect(status().isOk());

        List<String> keys = List.copyOf(redisTemplate.keys("recommendation:rate:*"));
        org.assertj.core.api.Assertions.assertThat(keys).hasSize(1);
        org.assertj.core.api.Assertions.assertThat(redisTemplate.getExpire(keys.getFirst()))
                .isPositive();
    }

    /** 형식이 틀린 요청은 한도를 쓰지 않습니다. 검증이 먼저입니다. */
    @Test
    void doesNotSpendQuotaOnInvalidRequest() throws Exception {
        for (int attempt = 0; attempt < ANONYMOUS_LIMIT + 5; attempt++) {
            mockMvc.perform(post(RECOMMEND_URL)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("{\"query\":\"  \"}"))
                    .andExpect(status().isBadRequest());
        }

        mockMvc.perform(request()).andExpect(status().isOk());
    }

    /**
     * 클릭·만족도는 <b>추천과 다른 통을 씁니다.</b>
     *
     * <p>한 통에 담으면 카드 다섯 개를 누르고 만족도를 남긴 사람이 추천 한도를 다 써 버립니다.
     * 추천을 한도까지 쓴 뒤에도 피드백은 그대로 받아야 합니다.
     */
    @Test
    void spendsSeparateQuotaFromRecommendations() throws Exception {
        for (int attempt = 0; attempt < ANONYMOUS_LIMIT; attempt++) {
            mockMvc.perform(request()).andExpect(status().isOk());
        }
        mockMvc.perform(request()).andExpect(status().isTooManyRequests());

        // 추천은 막혔지만 피드백은 살아 있어야 합니다. 없는 손잡이라 404 이고, 429 가 아닙니다.
        mockMvc.perform(feedbackRequest(UUID.randomUUID()))
                .andExpect(status().isNotFound());
    }

    /**
     * 피드백도 제 한도를 넘으면 429 입니다.
     *
     * <p><b>없는 손잡이도 한도를 씁니다.</b> 제한이 서비스보다 먼저 돌기 때문이고, 그래야
     * 손잡이를 무한히 찍어 볼 수 없습니다. 손잡이가 추측 불가능해도 제한이 없으면 시도 횟수에
     * 제약이 없어집니다.
     */
    @Test
    void rejectsFeedbackOverItsOwnLimit() throws Exception {
        for (int attempt = 0; attempt < FEEDBACK_ANONYMOUS_LIMIT; attempt++) {
            mockMvc.perform(feedbackRequest(UUID.randomUUID()))
                    .andExpect(status().isNotFound());
        }

        mockMvc.perform(feedbackRequest(UUID.randomUUID()))
                .andExpect(status().isTooManyRequests())
                .andExpect(jsonPath("$.code").value("RECOMMENDATION_RATE_LIMIT_EXCEEDED"));
    }

    /** 회원은 피드백도 비회원보다 많이 부를 수 있습니다. */
    @Test
    void givesMemberHigherFeedbackLimit() throws Exception {
        currentUser.login(USER_ID);

        for (int attempt = 0; attempt < FEEDBACK_ANONYMOUS_LIMIT + 1; attempt++) {
            mockMvc.perform(feedbackRequest(UUID.randomUUID()))
                    .andExpect(status().isNotFound());
        }
    }

    private org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder
            feedbackRequest(UUID token) {
        return post(RECOMMEND_URL + "/" + token + "/feedback")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"satisfaction\":\"SATISFIED\"}");
    }

    private org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder request() {
        return post(RECOMMEND_URL)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"query\":\"" + QUERY + "\"}");
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
     * 로그인 상태를 테스트가 정하는 {@link CurrentUser} 입니다.
     *
     * <p>실제 토큰을 만들지 않습니다. 여기서 볼 것은 "로그인했으면 한도가 다른가" 이고,
     * 토큰이 어떻게 발급·검증되는지는 인증 도메인의 테스트가 봅니다.
     */
    static class FakeCurrentUser implements CurrentUser {

        private Long id;

        void login(Long id) {
            this.id = id;
        }

        void logout() {
            this.id = null;
        }

        @Override
        public Optional<Long> id() {
            return Optional.ofNullable(id);
        }
    }
}
