package com.hyanghae.backend.recommendation;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.BDDMockito.given;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.hyanghae.backend.recommendation.client.NlrClient;
import com.hyanghae.backend.recommendation.client.NlrRecommendResponse;
import com.hyanghae.backend.support.IntegrationTest;
import java.util.Arrays;
import java.util.List;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

/**
 * AI 가 새로 보내기 시작한 여섯 칸이 실제로 표에 남는지 봅니다.
 *
 * <p>{@code lexicon_version} · {@code prompt_sha256} 과 미매칭 줄의 네 칸입니다. 이 값들은
 * 화면에 나가지 않아 눈으로는 빠진 것을 알 수 없습니다. 안 쌓여도 기능은 멀쩡해 보이고,
 * 반년 뒤에 집계를 열었을 때에야 비어 있는 것을 알게 됩니다. 그래서 표를 직접 봅니다.
 *
 * <p>가장 중요한 것은 {@code llm_accords} 입니다. 이 DB 의 첫 배열 컬럼이고, <b>빈 배열과
 * {@code NULL} 의 뜻이 다릅니다.</b> 빈 배열은 "LLM 이 향이 아니라고 답했다" 이고 {@code NULL}
 * 은 "묻지 않았다" 입니다. 둘을 뭉개면 이 표를 만든 목적 자체가 사라집니다.
 */
@IntegrationTest
@AutoConfigureMockMvc
class NlrRecordVersionFieldsIntegrationTest {

    private static final String RECOMMEND_URL = "/api/v1/recommendations/natural-language";
    private static final String QUERY = "빨래 냄새 나는 향수 찾고 있어";

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @MockitoBean
    private NlrClient nlrClient;

    @BeforeEach
    void insertFixtures() {
        clearAll();
        jdbcTemplate.update("INSERT INTO brands (brand_id, name) VALUES (1, 'Ostrikov')");
        jdbcTemplate.update("""
                INSERT INTO perfumes (perfume_id, brand_id, fragrantica_id, name, is_active)
                VALUES (1, 1, 73368, 'Laundry', TRUE)
                """);
    }

    @AfterEach
    void cleanUp() {
        clearAll();
    }

    @Test
    @DisplayName("사전 버전과 프롬프트 지문이 요청 줄에 남는다")
    void recordsLexiconVersionAndPromptSha() throws Exception {
        given(nlrClient.recommend(anyString()))
                .willReturn(aiResponse("v1_15", "4f0a368d98b41338", unmatched()));

        long id = recommendAndGetId();

        assertThat(one("SELECT lexicon_version FROM nlr_recommendations"
                + " WHERE recommendation_id = ?", String.class, id)).isEqualTo("v1_15");
        assertThat(one("SELECT prompt_sha256 FROM nlr_recommendations"
                + " WHERE recommendation_id = ?", String.class, id))
                .isEqualTo("4f0a368d98b41338");
    }

    /**
     * AI 가 모르면 {@code null} 을 보냅니다. 그 {@code null} 을 그대로 남깁니다.
     *
     * <p>사전 파일 이름이 규칙에 안 맞거나 프롬프트 파일을 못 읽었을 때입니다. 지어내서
     * 채우면 안 됩니다 — 비어 있으면 모른다는 것을 알지만, 틀리면 아는 줄 착각합니다.
     */
    @Test
    @DisplayName("AI 가 모른다고 하면 두 칸은 NULL 로 남는다")
    void keepsVersionsNullWhenAiDoesNotKnow() throws Exception {
        given(nlrClient.recommend(anyString())).willReturn(aiResponse(null, null, unmatched()));

        long id = recommendAndGetId();

        assertThat(one("SELECT lexicon_version FROM nlr_recommendations"
                + " WHERE recommendation_id = ?", String.class, id)).isNull();
        assertThat(one("SELECT prompt_sha256 FROM nlr_recommendations"
                + " WHERE recommendation_id = ?", String.class, id)).isNull();
    }

    @Test
    @DisplayName("미매칭 줄에 조건 여부 · 등급 · 결과 수가 남는다")
    void recordsUnmatchedContextColumns() throws Exception {
        given(nlrClient.recommend(anyString()))
                .willReturn(aiResponse("v1_15", "4f0a368d98b41338", unmatched()));

        long id = recommendAndGetId();

        assertThat(one("SELECT had_conditions FROM nlr_unmatched_expressions"
                + " WHERE recommendation_id = ?", Boolean.class, id)).isTrue();
        assertThat(one("SELECT tier FROM nlr_unmatched_expressions"
                + " WHERE recommendation_id = ?", String.class, id)).isEqualTo("LLM");
        assertThat(one("SELECT result_count FROM nlr_unmatched_expressions"
                + " WHERE recommendation_id = ?", Integer.class, id)).isEqualTo(1);
    }

    /**
     * accord 이름에 공백이 있습니다 — {@code white floral} · {@code warm spicy}.
     *
     * <p>문자열로 배열 리터럴을 조립하면 여기서 깨져 두 칸이 네 칸이 됩니다. 값 자체를
     * 되읽어 원소 수와 내용을 봅니다.
     */
    @Test
    @DisplayName("공백이 든 accord 이름이 배열로 그대로 남는다")
    void storesAccordNamesContainingSpaces() throws Exception {
        given(nlrClient.recommend(anyString())).willReturn(
                aiResponse("v1_15", "4f0a368d98b41338",
                        List.of(unmatchedWith(List.of("white floral", "warm spicy")))));

        long id = recommendAndGetId();

        assertThat(accordsOf(id)).containsExactly("white floral", "warm spicy");
    }

    /**
     * 빈 배열과 {@code NULL} 은 다른 사실입니다.
     *
     * <p>빈 배열 = LLM 이 "향이 아니다" 라고 답함(가격 · 성별 · 지속력 같은 것).
     * {@code NULL} = 묻지 않음(⑤단계가 꺼졌거나 조건이 이미 있었음).
     */
    @Test
    @DisplayName("빈 목록은 빈 배열로 남는다 — NULL 로 뭉개지 않는다")
    void keepsEmptyListAsEmptyArray() throws Exception {
        given(nlrClient.recommend(anyString())).willReturn(
                aiResponse("v1_15", "4f0a368d98b41338",
                        List.of(unmatchedWith(List.of()))));

        long id = recommendAndGetId();

        assertThat(one("SELECT llm_accords IS NULL FROM nlr_unmatched_expressions"
                + " WHERE recommendation_id = ?", Boolean.class, id)).isFalse();
        assertThat(accordsOf(id)).isEmpty();
    }

    @Test
    @DisplayName("묻지 않았으면 NULL 로 남는다")
    void keepsNullWhenNotAsked() throws Exception {
        given(nlrClient.recommend(anyString())).willReturn(
                aiResponse("v1_15", "4f0a368d98b41338",
                        List.of(unmatchedWith(null))));

        long id = recommendAndGetId();

        assertThat(one("SELECT llm_accords IS NULL FROM nlr_unmatched_expressions"
                + " WHERE recommendation_id = ?", Boolean.class, id)).isTrue();
    }

    /**
     * {@code llm_reasoning} 은 표에 칸이 있지만 AI 가 일부러 보내지 않습니다.
     *
     * <p>LLM 이 매핑한 뒤에 붙인 설명이라 근거가 아니고, 실측에서 없는 말을 지어냈습니다.
     * DB 에 쌓이면 화면으로 새어 나갈 길이 생깁니다. 우리가 다른 값으로 채우지 않는다는 것을
     * 고정합니다.
     */
    @Test
    @DisplayName("llm_reasoning 은 비워 둔다")
    void neverWritesLlmReasoning() throws Exception {
        given(nlrClient.recommend(anyString()))
                .willReturn(aiResponse("v1_15", "4f0a368d98b41338", unmatched()));

        long id = recommendAndGetId();

        assertThat(one("SELECT llm_reasoning FROM nlr_unmatched_expressions"
                + " WHERE recommendation_id = ?", String.class, id)).isNull();
    }

    private long recommendAndGetId() throws Exception {
        String body = mockMvc.perform(post(RECOMMEND_URL)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"query\":\"" + QUERY + "\"}"))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        String token = body.replaceAll(
                ".*\"recommendationToken\"\\s*:\\s*\"([0-9a-f-]+)\".*", "$1");
        Long id = jdbcTemplate.queryForObject(
                "SELECT recommendation_id FROM nlr_recommendations WHERE public_token = ?::uuid",
                Long.class, token);
        assertThat(id).as("기록이 남지 않았습니다").isNotNull();
        return id;
    }

    /** 배열 칸을 자바 목록으로 되읽습니다. {@code NULL} 이면 {@code null} 입니다. */
    private List<String> accordsOf(long recommendationId) {
        return jdbcTemplate.queryForObject(
                "SELECT llm_accords FROM nlr_unmatched_expressions WHERE recommendation_id = ?",
                (rs, rowNum) -> {
                    java.sql.Array array = rs.getArray("llm_accords");
                    return array == null ? null : Arrays.asList((String[]) array.getArray());
                },
                recommendationId);
    }

    private <T> T one(String sql, Class<T> type, long recommendationId) {
        return jdbcTemplate.queryForObject(sql, type, recommendationId);
    }

    private static List<NlrRecommendResponse.Unmatched> unmatched() {
        return List.of(unmatchedWith(List.of("amber", "sweet", "vanilla")));
    }

    private static NlrRecommendResponse.Unmatched unmatchedWith(List<String> accords) {
        return new NlrRecommendResponse.Unmatched(
                "포근한 느낌", "포근한느낌", "NOT_CORE", "kr.sens.cozy",
                true, accords, "LLM", 1);
    }

    private static NlrRecommendResponse aiResponse(
            String lexiconVersion,
            String promptSha256,
            List<NlrRecommendResponse.Unmatched> unmatched
    ) {
        return new NlrRecommendResponse(
                "OK",
                QUERY,
                lexiconVersion,
                promptSha256,
                new NlrRecommendResponse.Conditions(
                        List.of("soapy"), List.of(), List.of("빨래"), "llm+lexicon"),
                List.of(),
                List.of(new NlrRecommendResponse.Result(73368L,
                        List.of(new NlrRecommendResponse.Matched("soapy", "빨래", null)))),
                unmatched,
                new NlrRecommendResponse.Diagnostics("AND", 172, 1, List.of(), null));
    }

    private void clearAll() {
        jdbcTemplate.update("DELETE FROM nlr_recommendations");
        jdbcTemplate.update("DELETE FROM perfumes");
        jdbcTemplate.update("DELETE FROM brands");
    }
}
