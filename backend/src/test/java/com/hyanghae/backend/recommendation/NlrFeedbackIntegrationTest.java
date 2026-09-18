package com.hyanghae.backend.recommendation;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.BDDMockito.given;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.hyanghae.backend.recommendation.client.NlrClient;
import com.hyanghae.backend.recommendation.client.NlrRecommendResponse;
import com.hyanghae.backend.support.IntegrationTest;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;
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
 * 자연어 추천의 기록과 피드백을 실제 PostgreSQL 위에서 검증합니다.
 *
 * <p>여기서 볼 것은 화면에 나가는 모양이 아니라 <b>표에 무엇이 남는가</b> 입니다. 이 기록이
 * 사전을 무엇으로 넓힐지 정하는 유일한 실사용 근거라, 남지 않으면 기능이 있으나 마나입니다.
 *
 * <p>AI 호출만 대역으로 바꿉니다. 실제 AI 를 부르면 같은 문장이 실행마다 다른 조건을 내놓아
 * (①단계 LLM 이 매번 조금 다른 표현을 뽑습니다) 검증이 그날의 응답에 좌우됩니다.
 */
@IntegrationTest
@AutoConfigureMockMvc
class NlrFeedbackIntegrationTest {

    private static final String RECOMMEND_URL = "/api/v1/recommendations/natural-language";
    private static final String QUERY = "빨래 냄새 나는 향수 찾고 있어";

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
        jdbcTemplate.update(
                "INSERT INTO brands (brand_id, name) VALUES (1, 'Ostrikov Beauty Publishing')");
        insertPerfume(1, 73368L, "Laundry");
        insertPerfume(2, 1234L, "Soft Cotton");
    }

    @AfterEach
    void cleanUp() {
        clearAll();
    }

    /**
     * 추천 한 번이 표 셋에 남고 손잡이가 응답에 나옵니다.
     *
     * <p>화면은 이 값으로 클릭과 만족도를 보냅니다. 안 나가면 나머지 두 표가 영영 빕니다.
     */
    @Test
    void recordsRequestResultsAndUnmatched() throws Exception {
        given(nlrClient.recommend(anyString())).willReturn(aiResponse());

        String token = recommend();
        long id = idOf(token);

        assertThat(queryForString(
                "SELECT raw_query FROM nlr_recommendations WHERE recommendation_id = ?", id))
                .isEqualTo(QUERY);
        assertThat(queryForString(
                "SELECT status FROM nlr_recommendations WHERE recommendation_id = ?", id))
                .isEqualTo("OK");

        // 조건과 진단이 그대로 남아야 "이 조건에서 왜 이 향수가 나왔나" 를 다시 볼 수 있습니다.
        assertThat(queryForString(
                "SELECT core_accords FROM nlr_recommendations WHERE recommendation_id = ?", id))
                .isEqualTo("soapy|fresh");
        assertThat(queryForString(
                "SELECT stage FROM nlr_recommendations WHERE recommendation_id = ?", id))
                .isEqualTo("AND");
        assertThat(jdbcTemplate.queryForObject(
                "SELECT candidate_count FROM nlr_recommendations WHERE recommendation_id = ?",
                Integer.class, id))
                .isEqualTo(172);

        // 순위가 AI 가 준 순서 그대로여야 합니다.
        assertThat(jdbcTemplate.queryForList(
                "SELECT perfume_id FROM nlr_recommendation_items"
                        + " WHERE recommendation_id = ? ORDER BY rank", Long.class, id))
                .containsExactly(1L, 2L);

        assertThat(queryForString(
                "SELECT expression FROM nlr_unmatched_expressions WHERE recommendation_id = ?", id))
                .isEqualTo("무겁지 않게");
    }

    /**
     * <b>응답에 내부 번호가 나가지 않습니다.</b>
     *
     * <p>{@code recommendation_id} 는 1부터 차례로 붙습니다. 그것을 내보내면 1부터 세기만 해도
     * 남의 추천에 만족도를 남기고 클릭을 채울 수 있습니다.
     */
    @Test
    void servesTokenNotSequentialId() throws Exception {
        given(nlrClient.recommend(anyString())).willReturn(aiResponse());

        mockMvc.perform(post(RECOMMEND_URL)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"query\":\"" + QUERY + "\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.recommendationId").doesNotExist())
                .andExpect(jsonPath("$.recommendationToken")
                        .value(org.hamcrest.Matchers.matchesPattern(
                                "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}")));
    }

    /**
     * <b>내부 번호로는 보낼 수 없습니다.</b>
     *
     * <p>이 단언이 깨지면 경로가 숫자를 받는다는 뜻이고, 그러면 1부터 세어 남의 추천을 전부
     * 건드릴 수 있습니다. 이 기능에서 가장 비싼 실수입니다 — 오염된 줄과 진짜 줄을 나중에
     * 구분할 방법이 없습니다.
     */
    @Test
    void rejectsInternalIdInPath() throws Exception {
        given(nlrClient.recommend(anyString())).willReturn(aiResponse());
        long id = idOf(recommend());

        mockMvc.perform(post(RECOMMEND_URL + "/" + id + "/feedback")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"satisfaction\":\"SATISFIED\"}"))
                .andExpect(status().isBadRequest());

        assertThat(jdbcTemplate.queryForObject(
                "SELECT count(*) FROM nlr_feedbacks", Integer.class))
                .isZero();
    }

    /**
     * AI 계약에 아직 없는 칸은 비어 있습니다.
     *
     * <p><b>이 단언이 깨지면 계약이 넓어졌다는 뜻입니다.</b> 그때는 값을 채우도록 고치고 이
     * 테스트를 값 검증으로 바꾸면 됩니다. {@code had_conditions} 를 {@code NOT NULL} 로 두지
     * 않은 이유가 여기에 있습니다 — 그랬다면 미매칭이 한 줄도 안 남습니다.
     */
    @Test
    void leavesColumnsTheAiDoesNotSendYetEmpty() throws Exception {
        given(nlrClient.recommend(anyString())).willReturn(aiResponse());
        long id = idOf(recommend());

        assertThat(jdbcTemplate.queryForObject(
                "SELECT had_conditions FROM nlr_unmatched_expressions"
                        + " WHERE recommendation_id = ?", Boolean.class, id))
                .isNull();
        assertThat(queryForString(
                "SELECT lexicon_version FROM nlr_recommendations WHERE recommendation_id = ?", id))
                .isNull();
    }

    /** 누른 순위가 남습니다. */
    @Test
    void recordsClick() throws Exception {
        given(nlrClient.recommend(anyString())).willReturn(aiResponse());
        String token = recommend();

        mockMvc.perform(post(RECOMMEND_URL + "/" + token + "/clicks")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"rank\":2}"))
                .andExpect(status().isNoContent());

        assertThat(clickedAt(idOf(token), 2)).isNotNull();
        assertThat(clickedAt(idOf(token), 1)).isNull();
    }

    /**
     * 같은 카드를 다시 눌러도 처음 시각을 지킵니다.
     *
     * <p>덮어쓰면 "추천을 받고 얼마 만에 눌렀나" 가 마지막 클릭 기준으로 바뀝니다. 화면을
     * 뒤로 갔다 돌아와 다시 누르는 일이 흔해서 실제로 일어납니다.
     */
    @Test
    void keepsTheFirstClickTime() throws Exception {
        given(nlrClient.recommend(anyString())).willReturn(aiResponse());
        String token = recommend();

        click(token, 1);
        OffsetDateTime first = clickedAt(idOf(token), 1);
        click(token, 1);

        assertThat(clickedAt(idOf(token), 1)).isEqualTo(first);
    }

    /** 없는 손잡이로 오는 클릭은 404 입니다. */
    @Test
    void rejectsClickOnUnknownToken() throws Exception {
        mockMvc.perform(post(RECOMMEND_URL + "/" + UUID.randomUUID() + "/clicks")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"rank\":1}"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("RECOMMENDATION_RECORD_NOT_FOUND"));
    }

    /** 그 추천에 없던 순위도 404 입니다. 결과가 둘인데 5위를 눌렀다고 올 수는 없습니다. */
    @Test
    void rejectsClickOnRankThatWasNotServed() throws Exception {
        given(nlrClient.recommend(anyString())).willReturn(aiResponse());
        String token = recommend();

        mockMvc.perform(post(RECOMMEND_URL + "/" + token + "/clicks")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"rank\":5}"))
                .andExpect(status().isNotFound());
    }

    /** 순위는 1~5 입니다. 범위 밖은 요청 DTO 가 400 으로 막습니다. */
    @Test
    void rejectsRankOutOfRange() throws Exception {
        given(nlrClient.recommend(anyString())).willReturn(aiResponse());
        String token = recommend();

        mockMvc.perform(post(RECOMMEND_URL + "/" + token + "/clicks")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"rank\":0}"))
                .andExpect(status().isBadRequest());
    }

    /** 만족도가 남습니다. */
    @Test
    void recordsFeedback() throws Exception {
        given(nlrClient.recommend(anyString())).willReturn(aiResponse());
        String token = recommend();

        mockMvc.perform(post(RECOMMEND_URL + "/" + token + "/feedback")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"satisfaction\":\"SATISFIED\",\"comment\":\"원하던 느낌\"}"))
                .andExpect(status().isCreated());

        assertThat(queryForString(
                "SELECT satisfaction FROM nlr_feedbacks WHERE recommendation_id = ?", idOf(token)))
                .isEqualTo("SATISFIED");
        assertThat(queryForString(
                "SELECT comment FROM nlr_feedbacks WHERE recommendation_id = ?", idOf(token)))
                .isEqualTo("원하던 느낌");
    }

    /** 한마디는 선택입니다. */
    @Test
    void recordsFeedbackWithoutComment() throws Exception {
        given(nlrClient.recommend(anyString())).willReturn(aiResponse());
        String token = recommend();

        mockMvc.perform(post(RECOMMEND_URL + "/" + token + "/feedback")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"satisfaction\":\"NEUTRAL\"}"))
                .andExpect(status().isCreated());

        assertThat(queryForString(
                "SELECT comment FROM nlr_feedbacks WHERE recommendation_id = ?", idOf(token)))
                .isNull();
    }

    /**
     * 두 번째 답은 409 입니다.
     *
     * <p>표의 기본키가 막아 주지만 그대로 두면 500 이 나갑니다. 화면을 다시 열어 같은 버튼이
     * 눌리는 일이 있어 실제로 옵니다.
     */
    @Test
    void rejectsSecondFeedback() throws Exception {
        given(nlrClient.recommend(anyString())).willReturn(aiResponse());
        String token = recommend();
        feedback(token, "SATISFIED");

        mockMvc.perform(post(RECOMMEND_URL + "/" + token + "/feedback")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"satisfaction\":\"DISSATISFIED\"}"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code")
                        .value("RECOMMENDATION_FEEDBACK_ALREADY_ANSWERED"));

        // 처음 답이 그대로여야 합니다.
        assertThat(queryForString(
                "SELECT satisfaction FROM nlr_feedbacks WHERE recommendation_id = ?", idOf(token)))
                .isEqualTo("SATISFIED");
    }

    /** 세 값 밖의 만족도는 400 입니다. DB 의 CHECK 까지 내려가면 500 이 됩니다. */
    @Test
    void rejectsUnknownSatisfaction() throws Exception {
        given(nlrClient.recommend(anyString())).willReturn(aiResponse());
        String token = recommend();

        mockMvc.perform(post(RECOMMEND_URL + "/" + token + "/feedback")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"satisfaction\":\"VERY_GOOD\"}"))
                .andExpect(status().isBadRequest());
    }

    /** 없는 손잡이에 만족도를 보내면 404 입니다. */
    @Test
    void rejectsFeedbackOnUnknownToken() throws Exception {
        mockMvc.perform(post(RECOMMEND_URL + "/" + UUID.randomUUID() + "/feedback")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"satisfaction\":\"SATISFIED\"}"))
                .andExpect(status().isNotFound());
    }

    /**
     * 손잡이 모양이 아니면 400 입니다. <b>404 가 아닙니다.</b>
     *
     * <p>둘을 가르는 기준이 다릅니다. 404 는 "그런 추천이 없다" 이고 400 은 "그건 손잡이가
     * 아니다" 입니다. 형식이 틀린 값은 경로 변환에서 막혀 서비스까지 오지도 않으므로 있는지
     * 없는지를 따질 대상이 아닙니다.
     *
     * <p>이 구분이 실제로 쓸모가 있습니다. 화면이 400 을 받으면 <b>보내는 값 자체가 잘못된
     * 것</b>이고(변수를 잘못 넣었거나 null 을 문자열로 만들었거나), 404 면 값은 맞는데 그
     * 추천이 없는 것입니다. 고쳐야 할 곳이 다릅니다.
     */
    @Test
    void rejectsMalformedToken() throws Exception {
        for (String malformed : List.of("not-a-uuid", "123", "22aab31b-5fda-4be0-9b61")) {
            mockMvc.perform(post(RECOMMEND_URL + "/" + malformed + "/feedback")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("{\"satisfaction\":\"SATISFIED\"}"))
                    .andExpect(status().isBadRequest());

            mockMvc.perform(post(RECOMMEND_URL + "/" + malformed + "/clicks")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("{\"rank\":1}"))
                    .andExpect(status().isBadRequest());
        }

        assertThat(jdbcTemplate.queryForObject(
                "SELECT count(*) FROM nlr_feedbacks", Integer.class))
                .isZero();
    }

    /** 추천을 한 번 받고 손잡이를 돌려줍니다. 화면이 받는 것과 같은 값입니다. */
    private String recommend() throws Exception {
        clearRateLimit();
        String body = mockMvc.perform(post(RECOMMEND_URL)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"query\":\"" + QUERY + "\"}"))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        return body.replaceAll(".*\"recommendationToken\"\\s*:\\s*\"([0-9a-f-]+)\".*", "$1");
    }

    /** 손잡이로 내부 번호를 찾습니다. 표를 직접 볼 때만 씁니다. */
    private long idOf(String token) {
        Long id = jdbcTemplate.queryForObject(
                "SELECT recommendation_id FROM nlr_recommendations WHERE public_token = ?::uuid",
                Long.class, token);
        return id == null ? -1 : id;
    }

    private void click(String token, int rank) throws Exception {
        mockMvc.perform(post(RECOMMEND_URL + "/" + token + "/clicks")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"rank\":" + rank + "}"))
                .andExpect(status().isNoContent());
    }

    private void feedback(String token, String satisfaction) throws Exception {
        mockMvc.perform(post(RECOMMEND_URL + "/" + token + "/feedback")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"satisfaction\":\"" + satisfaction + "\"}"))
                .andExpect(status().isCreated());
    }

    private OffsetDateTime clickedAt(long recommendationId, int rank) {
        return jdbcTemplate.queryForObject(
                "SELECT clicked_at FROM nlr_recommendation_items"
                        + " WHERE recommendation_id = ? AND rank = ?",
                OffsetDateTime.class, recommendationId, rank);
    }

    private String queryForString(String sql, long recommendationId) {
        return jdbcTemplate.queryForObject(sql, String.class, recommendationId);
    }

    private static NlrRecommendResponse aiResponse() {
        return new NlrRecommendResponse(
                "OK",
                QUERY,
                new NlrRecommendResponse.Conditions(
                        List.of("soapy", "fresh"), List.of(), List.of("빨래"), "llm+lexicon"),
                List.of(
                        new NlrRecommendResponse.Result(73368L,
                                List.of(new NlrRecommendResponse.Matched("soapy", "빨래"))),
                        new NlrRecommendResponse.Result(1234L,
                                List.of(new NlrRecommendResponse.Matched("fresh", "빨래")))),
                List.of(new NlrRecommendResponse.Unmatched(
                        "무겁지 않게", "무겁지않게", "NOT_IN_LEXICON", null)),
                new NlrRecommendResponse.Diagnostics("AND", 172, 1, List.of(), null));
    }

    private void insertPerfume(long perfumeId, Long fragranticaId, String name) {
        jdbcTemplate.update("""
                INSERT INTO perfumes (perfume_id, brand_id, fragrantica_id, name, is_active)
                VALUES (?, 1, ?, ?, TRUE)
                """, perfumeId, fragranticaId, name);
    }

    /**
     * {@code nlr_recommendations} 를 먼저 지웁니다. 나머지 셋이 {@code ON DELETE CASCADE} 로
     * 딸려 나갑니다. 향수를 먼저 지우면 결과 줄만 사라지고 요청 줄이 남아, 다음 테스트가 "결과
     * 없는 요청" 을 보게 됩니다.
     */
    private void clearAll() {
        jdbcTemplate.update("DELETE FROM nlr_recommendations");
        jdbcTemplate.update("DELETE FROM perfumes");
        jdbcTemplate.update("DELETE FROM brands");
        clearRateLimit();
    }

    private void clearRateLimit() {
        redisTemplate.delete(redisTemplate.keys("recommendation:rate:*"));
    }
}
