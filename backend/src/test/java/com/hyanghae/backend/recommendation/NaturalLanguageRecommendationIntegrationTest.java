package com.hyanghae.backend.recommendation;

import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.BDDMockito.given;
import static org.mockito.BDDMockito.willThrow;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.hyanghae.backend.global.exception.BusinessException;
import com.hyanghae.backend.recommendation.client.NlrClient;
import com.hyanghae.backend.recommendation.client.NlrRecommendResponse;
import com.hyanghae.backend.recommendation.exception.RecommendationErrorCode;
import com.hyanghae.backend.support.IntegrationTest;
import java.util.List;
import org.hamcrest.Matchers;
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
 * 자연어 추천 API 를 실제 PostgreSQL 위에서 검증합니다.
 *
 * <p>AI 호출만 대역으로 바꿉니다. 여기서 볼 것은 "AI 가 준 {@code fragranticaId} 로 우리
 * 향수를 제대로 찾아 응답을 만드는가" 이고, 그 판단은 전부 데이터베이스 상태로 드러납니다.
 * 실제 AI 를 부르면 검증이 그날의 LLM 응답에 좌우되고, AI 서버가 없는 CI 에서는 아예 돌지
 * 않습니다.
 *
 * <p>고정 데이터는 조회의 갈림길을 하나씩 담고 있습니다.
 *
 * <ul>
 *   <li>향수 1: {@code fragrantica_id} 가 있고 활성입니다. 정상 경로입니다.
 *   <li>향수 2: 브랜드가 없습니다. {@code brand_id} 가 nullable 이라 생길 수 있습니다.
 *   <li>향수 3: 비활성입니다. 추천에서 빠져야 합니다.
 *   <li>향수 4: {@code fragrantica_id} 가 {@code NULL} 입니다. 적재가 짝지어 주지 못한
 *       향수이고, {@code NULL} 은 무엇과도 같지 않으므로 어떤 번호로도 찾히면 안 됩니다.
 * </ul>
 */
@IntegrationTest
@AutoConfigureMockMvc
class NaturalLanguageRecommendationIntegrationTest {

    private static final String RECOMMEND_URL = "/api/v1/recommendations/natural-language";
    private static final String QUERY = "빨래 냄새 나는 향수 찾고 있어";
    private static final String THUMBNAIL = "https://img.example.com/laundry.jpg";

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
        clearPerfumeData();
        clearRateLimit();

        insertBrand(1, "Ostrikov Beauty Publishing");

        insertPerfume(1, 1, 73368L, "Laundry", true);
        insertPerfume(2, null, 1234L, "Orphan Scent", true);
        insertPerfume(3, 1, 5678L, "Retired Scent", false);
        insertPerfume(4, 1, null, "Unlinked Scent", true);

        insertImage(10, 1, THUMBNAIL, 1);
    }

    @AfterEach
    void cleanUp() {
        clearPerfumeData();
    }

    /** AI 가 준 번호로 우리 향수를 찾아 계약이 정한 모양으로 돌려줍니다. */
    @Test
    void resolvesPerfumesByFragranticaId() throws Exception {
        given(nlrClient.recommend(anyString())).willReturn(aiResponse("OK",
                result(73368L, matched("soapy", "빨래"), matched("fresh", "빨래"))));

        mockMvc.perform(request(QUERY))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("OK"))
                .andExpect(jsonPath("$.query").value(QUERY))
                .andExpect(jsonPath("$.perfumes.length()").value(1))
                .andExpect(jsonPath("$.perfumes[0].perfumeId").value(1))
                .andExpect(jsonPath("$.perfumes[0].name").value("Laundry"))
                .andExpect(jsonPath("$.perfumes[0].brand").value("Ostrikov Beauty Publishing"))
                .andExpect(jsonPath("$.perfumes[0].originalName").value("Laundry"))
                .andExpect(jsonPath("$.perfumes[0].originalBrand")
                        .value("Ostrikov Beauty Publishing"))
                .andExpect(jsonPath("$.perfumes[0].thumbnailUrl").value(THUMBNAIL))
                .andExpect(jsonPath("$.perfumes[0].reasons.length()").value(1))
                .andExpect(jsonPath("$.perfumes[0].reasons[0].phrase").value("빨래"))
                .andExpect(jsonPath("$.perfumes[0].reasons[0].evidence").value("soapy · fresh"));
    }

    /**
     * 향 강도가 응답에 실려 나갑니다 (AI 요청 2026-09-25).
     *
     * <p>화면이 {@code evidence} 를 {@code ' · '} 로 자른 뒤 {@code strengths} 와 순서로
     * 짝짓습니다. <b>JSON 으로 나가는 모양</b>을 여기서 봅니다 — 값이 맞는지는 서비스 단위
     * 테스트가 보고, 여기서는 칸이 실제로 직렬화되어 나가는지가 관심사입니다.
     */
    @Test
    void servesStrengthWithEachReason() throws Exception {
        given(nlrClient.recommend(anyString())).willReturn(aiResponse("OK",
                result(73368L, matched("soapy", "빨래", 100), matched("fresh", "빨래", 93))));

        mockMvc.perform(request(QUERY))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.perfumes[0].reasons[0].evidence").value("soapy · fresh"))
                .andExpect(jsonPath("$.perfumes[0].reasons[0].strengths.length()").value(2))
                .andExpect(jsonPath("$.perfumes[0].reasons[0].strengths[0]").value(100))
                .andExpect(jsonPath("$.perfumes[0].reasons[0].strengths[1]").value(93));
    }

    /**
     * 내부 기록은 응답에 없습니다.
     *
     * <p>{@code accord}·{@code tier}·{@code diagnostics} 는 사용자에게 내보내지 않기로 계약이
     * 정했습니다.
     *
     * <p><b>{@code strength} 는 이 목록에서 빠졌습니다.</b> 원래는 함께 감췄는데, 추천 이유가
     * 향 이름만 보여 주고 있어 <i>"왜 이 향수인가"</i> 에 답이 되지 않았습니다. 지금은
     * {@code reasons[].strengths} 로 나갑니다. 다만 <b>이름 그대로는 아닙니다</b> — 원본은
     * 향 하나의 값이고 내보내는 것은 {@code evidence} 조각과 짝이 맞는 목록입니다.
     */
    @Test
    void doesNotExposeInternalFields() throws Exception {
        given(nlrClient.recommend(anyString())).willReturn(aiResponse("OK",
                result(73368L, matched("soapy", "빨래"))));

        mockMvc.perform(request(QUERY))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.diagnostics").doesNotExist())
                .andExpect(jsonPath("$.conditions").doesNotExist())
                .andExpect(jsonPath("$.perfumes[0].fragranticaId").doesNotExist())
                .andExpect(jsonPath("$.perfumes[0].reasons[0].accord").doesNotExist())
                .andExpect(jsonPath("$.perfumes[0].reasons[0].tier").doesNotExist());
    }

    /**
     * 향 조건 없이 고른 추천도 <b>이유가 붙어서</b> 나갑니다 (AI {@code S15P21E203-351}).
     *
     * <p>{@code matched} 가 비어 있어 예전 같으면 이유 없는 카드가 나갔습니다. 요구사항
     * NLR-07 은 추천마다 이유를 요구하고 계약은 1~3개로 정했습니다.
     *
     * <p>최상위 {@code matchedData} 도 함께 나갑니다. <b>화면이 이것으로 "향으로 고른 것이
     * 아니다" 를 압니다</b> — {@code status} 는 {@code OK_RELAXED} 라 조건을 넓힌 경우와
     * 구분되지 않습니다. 내부 값인 {@code value}·{@code tier} 는 빠집니다.
     */
    @Test
    void servesReasonsWhenPickedWithoutScentCondition() throws Exception {
        given(nlrClient.recommend(anyString())).willReturn(contextOnlyResponse());

        mockMvc.perform(request(QUERY))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("OK_RELAXED"))
                .andExpect(jsonPath("$.pickedWithoutScentCondition").value(true))
                .andExpect(jsonPath("$.matchedData.length()").value(1))
                .andExpect(jsonPath("$.matchedData[0].field").value("gender"))
                .andExpect(jsonPath("$.matchedData[0].label").value("중성적인"))
                .andExpect(jsonPath("$.matchedData[0].value").doesNotExist())
                .andExpect(jsonPath("$.matchedData[0].tier").doesNotExist())
                .andExpect(jsonPath("$.perfumes[0].reasons.length()").value(1))
                .andExpect(jsonPath("$.perfumes[0].reasons[0].phrase").doesNotExist())
                .andExpect(jsonPath("$.perfumes[0].reasons[0].evidence").value("중성적인"));
    }

    /**
     * 향 근거가 있으면 향이 아닌 근거는 <b>최상위로만</b> 나갑니다.
     *
     * <p>⚠ <b>노트를 브리지로 푼 accord 는 {@code from} 이 {@code null} 입니다</b>(AI 실측).
     * 성별·낮밤도 {@code from} 이 없어, 둘을 한 목록에 넣으면 같은 줄로 합쳐져
     * <i>"floral · rose · 밤에 어울리는"</i> 처럼 영어 accord 와 화면용 한국어가 섞입니다.
     * 그래서 {@code reasons} 에는 향 근거만 넣고 나머지는 {@code matchedData} 로 보냅니다.
     *
     * <p>화면은 {@code pickedWithoutScentCondition} 으로 두 경우를 가릅니다. 여기서는 향으로
     * 골랐으므로 {@code false} 입니다.
     */
    @Test
    void servesDataReasonsOnlyAtTopLevelWhenScentReasonsExist() throws Exception {
        given(nlrClient.recommend(anyString())).willReturn(mixedReasonResponse());

        mockMvc.perform(request(QUERY))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("OK"))
                .andExpect(jsonPath("$.pickedWithoutScentCondition").value(false))
                .andExpect(jsonPath("$.matchedData.length()").value(2))
                .andExpect(jsonPath("$.matchedData[0].field").value("note"))
                .andExpect(jsonPath("$.matchedData[0].label").value("장미"))
                .andExpect(jsonPath("$.matchedData[1].field").value("daypart"))
                .andExpect(jsonPath("$.matchedData[1].label").value("밤에 어울리는"))
                .andExpect(jsonPath("$.perfumes[0].reasons.length()").value(1))
                .andExpect(jsonPath("$.perfumes[0].reasons[0].phrase").doesNotExist())
                .andExpect(jsonPath("$.perfumes[0].reasons[0].evidence").value("floral · rose"));
    }

    /** 조건을 안 걸었으면 {@code matchedData} 는 {@code null} 이 아니라 빈 배열입니다. */
    @Test
    void servesEmptyMatchedDataWhenNoDataCondition() throws Exception {
        given(nlrClient.recommend(anyString())).willReturn(aiResponse("OK",
                result(73368L, matched("soapy", "빨래"))));

        mockMvc.perform(request(QUERY))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.matchedData").isArray())
                .andExpect(jsonPath("$.matchedData.length()").value(0));
    }

    /**
     * 한국어 이름이 있으면 {@code name} · {@code brand} 는 예전처럼 한국어이고, 원래 이름은
     * {@code originalName} · {@code originalBrand} 로 따로 나갑니다. 영어 요청이어도 같습니다.
     */
    @Test
    void servesOriginalNamesNextToKoreanNames() throws Exception {
        jdbcTemplate.update("UPDATE perfumes SET name_ko = '런드리' WHERE perfume_id = 1");
        jdbcTemplate.update("UPDATE brands SET name_ko = '오스트리코프' WHERE brand_id = 1");
        given(nlrClient.recommend(anyString())).willReturn(aiResponse("OK",
                result(73368L, matched("soapy", "빨래"))));

        for (String language : new String[]{"ko", "en"}) {
            clearRateLimit();
            mockMvc.perform(request(QUERY).header("Accept-Language", language))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.perfumes[0].name").value("런드리"))
                    .andExpect(jsonPath("$.perfumes[0].brand").value("오스트리코프"))
                    .andExpect(jsonPath("$.perfumes[0].originalName").value("Laundry"))
                    .andExpect(jsonPath("$.perfumes[0].originalBrand")
                            .value("Ostrikov Beauty Publishing"));
        }
    }

    /** 브랜드가 없는 향수도 나갑니다. {@code brand} 만 {@code null} 입니다. */
    @Test
    void servesPerfumeWithoutBrand() throws Exception {
        given(nlrClient.recommend(anyString())).willReturn(aiResponse("OK",
                result(1234L, matched("fresh", "빨래"))));

        mockMvc.perform(request(QUERY))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.perfumes[0].perfumeId").value(2))
                .andExpect(jsonPath("$.perfumes[0].brand").doesNotExist())
                .andExpect(jsonPath("$.perfumes[0].originalBrand").doesNotExist())
                .andExpect(jsonPath("$.perfumes[0].thumbnailUrl").doesNotExist());
    }

    /**
     * 비활성 향수는 추천되지 않습니다. 검색·상세와 같은 기준입니다.
     *
     * <p>보여줄 향수가 안 남으므로 {@code NO_RESULT} 입니다.
     */
    @Test
    void excludesInactivePerfume() throws Exception {
        given(nlrClient.recommend(anyString())).willReturn(aiResponse("OK",
                result(5678L, matched("soapy", "빨래"))));

        mockMvc.perform(request(QUERY))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("NO_RESULT"))
                .andExpect(jsonPath("$.perfumes").isEmpty());
    }

    /**
     * 단종이 확인된 향수는 AI 가 골라도 내보내지 않습니다 (지인 피드백 F5). AI 서버도 같은 목록으로
     * 거르지만, 두 쪽 배포가 어긋나도 살 수 없는 향수를 권하지 않게 백엔드가 한 번 더 막습니다.
     */
    @Test
    void excludesDiscontinuedPerfume() throws Exception {
        markDiscontinued(1);
        given(nlrClient.recommend(anyString())).willReturn(aiResponse("OK",
                result(73368L, matched("soapy", "빨래")),
                result(1234L, matched("soapy", "빨래"))));

        mockMvc.perform(request(QUERY))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.perfumes[*].perfumeId", Matchers.contains(2)));
    }

    /**
     * 적재가 짝지어 주지 못한 향수는 어떤 번호로도 찾히지 않습니다.
     *
     * <p>{@code fragrantica_id} 가 {@code NULL} 인 행입니다. SQL 에서 {@code NULL} 은 무엇과도
     * 같지 않으므로 {@code IN} 절에 걸리지 않습니다. 이것이 깨지면 엉뚱한 향수가 추천됩니다.
     */
    @Test
    void doesNotMatchPerfumeWithoutFragranticaId() throws Exception {
        given(nlrClient.recommend(anyString())).willReturn(aiResponse("OK",
                result(4L, matched("soapy", "빨래"))));

        mockMvc.perform(request(QUERY))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("NO_RESULT"))
                .andExpect(jsonPath("$.perfumes").isEmpty());
    }

    /**
     * 향 조건을 못 뽑으면 빈 배열입니다. <b>인기 향수로 채우지 않습니다.</b>
     *
     * <p>추천처럼 보이지만 근거가 없어 요구사항 NLR-07 을 어깁니다. 드문 경우도 아닙니다 —
     * 실사용자 설문 155건에서 48.4% 입니다.
     */
    @Test
    void servesEmptyListWhenNoConditionWasFound() throws Exception {
        given(nlrClient.recommend(anyString())).willReturn(aiResponse("NO_CONDITION"));

        mockMvc.perform(request(QUERY))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("NO_CONDITION"))
                .andExpect(jsonPath("$.perfumes").isArray())
                .andExpect(jsonPath("$.perfumes").isEmpty());
    }

    /** 조건을 넓혀 찾은 결과는 그대로 전달합니다. 화면이 "조건이 넓습니다" 를 함께 보여줍니다. */
    @Test
    void passesRelaxedStatusThrough() throws Exception {
        given(nlrClient.recommend(anyString())).willReturn(aiResponse("OK_RELAXED",
                result(73368L, matched("soapy", "빨래"))));

        mockMvc.perform(request(QUERY))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("OK_RELAXED"));
    }

    /** AI 서버가 응답하지 않으면 503 입니다. 공통 에러 형식을 씁니다. */
    @Test
    void returnsServiceUnavailableWhenAiServerIsDown() throws Exception {
        willThrow(new BusinessException(RecommendationErrorCode.RECOMMENDATION_AI_UNAVAILABLE))
                .given(nlrClient).recommend(anyString());

        mockMvc.perform(request(QUERY))
                .andExpect(status().isServiceUnavailable())
                .andExpect(jsonPath("$.code").value("RECOMMENDATION_AI_UNAVAILABLE"))
                .andExpect(jsonPath("$.message").exists());
    }

    /** 빈 문장은 400 입니다. AI 서버까지 가지 않습니다. */
    @Test
    void rejectsBlankQuery() throws Exception {
        mockMvc.perform(request("   "))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("BAD_REQUEST"));
    }

    /** 500자를 넘는 문장은 400 입니다. AI 서버도 같은 범위만 받습니다. */
    @Test
    void rejectsQueryLongerThanFiveHundredCharacters() throws Exception {
        mockMvc.perform(request("가".repeat(501)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("BAD_REQUEST"));
    }

    /** 경계값인 500자는 받습니다. */
    @Test
    void acceptsQueryOfExactlyFiveHundredCharacters() throws Exception {
        given(nlrClient.recommend(anyString())).willReturn(aiResponse("NO_CONDITION"));

        mockMvc.perform(request("가".repeat(500)))
                .andExpect(status().isOk());
    }

    /** {@code query} 칸이 아예 없으면 400 입니다. */
    @Test
    void rejectsRequestWithoutQueryField() throws Exception {
        mockMvc.perform(post(RECOMMEND_URL)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{}"))
                .andExpect(status().isBadRequest());
    }

    private org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder request(
            String query) {
        return post(RECOMMEND_URL)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"query\":\"" + query + "\"}");
    }

    private static NlrRecommendResponse aiResponse(
            String status, NlrRecommendResponse.Result... results) {
        return new NlrRecommendResponse(
                status, QUERY, null, null, null, List.of(), List.of(results), null, null);
    }

    /**
     * 향 근거와 향이 아닌 근거가 함께 있는 응답입니다. 실사용에서 가장 흔한 모양입니다.
     *
     * <p><b>{@code matched[].from} 이 {@code null} 입니다.</b> {@code 장미} 를 노트 브리지가
     * {@code floral}·{@code rose} 로 풀 때 AI 는 어느 글자에서 왔는지를 안 채웁니다 —
     * 사전이 직접 잡은 {@code 빨래} 와 다른 점이고, 둘을 한 목록에 섞으면 깨지는 이유입니다.
     */
    private static NlrRecommendResponse mixedReasonResponse() {
        return new NlrRecommendResponse(
                "OK", QUERY, null, null,
                new NlrRecommendResponse.Conditions(
                        List.of("floral", "rose"), List.of(), List.of(), "lexicon_only"),
                List.of(new NlrRecommendResponse.MatchedData(
                                "note", "rose", "장미", "장미", "DATA"),
                        new NlrRecommendResponse.MatchedData(
                                "daypart", "night", "밤에 어울리는", null, "DATA")),
                List.of(new NlrRecommendResponse.Result(73368L, List.of(
                        new NlrRecommendResponse.Matched("floral", null, null),
                        new NlrRecommendResponse.Matched("rose", null, null)))),
                List.of(),
                new NlrRecommendResponse.Diagnostics("AND", 618, 1, List.of(), null));
    }

    /** 향 조건 없이 성별로만 고른 응답입니다. {@code matched} 가 비고 {@code matchedData} 만 찹니다. */
    private static NlrRecommendResponse contextOnlyResponse() {
        return new NlrRecommendResponse(
                "OK_RELAXED", QUERY, null, null,
                new NlrRecommendResponse.Conditions(List.of(), List.of(), List.of(), "lexicon_only"),
                List.of(new NlrRecommendResponse.MatchedData(
                        "gender", "unisex", "중성적인", null, "DATA")),
                List.of(new NlrRecommendResponse.Result(73368L, List.of())),
                List.of(),
                new NlrRecommendResponse.Diagnostics("CONTEXT_ONLY", 21341, 21341, List.of(), null));
    }

    private static NlrRecommendResponse.Result result(
            Long fragranticaId, NlrRecommendResponse.Matched... matched) {
        return new NlrRecommendResponse.Result(fragranticaId, List.of(matched));
    }

    /** 강도를 따지지 않는 검사용입니다. AI 가 그 칸을 안 보낸 경우와 같습니다. */
    private static NlrRecommendResponse.Matched matched(String accord, String from) {
        return matched(accord, from, null);
    }

    private static NlrRecommendResponse.Matched matched(
            String accord, String from, Integer strength) {
        return new NlrRecommendResponse.Matched(accord, from, strength);
    }

    private void insertBrand(long id, String name) {
        jdbcTemplate.update(
                "INSERT INTO brands (brand_id, name, is_active) VALUES (?, ?, true)", id, name);
    }

    private void insertPerfume(
            long id, Integer brandId, Long fragranticaId, String name, boolean active) {
        jdbcTemplate.update(
                "INSERT INTO perfumes (perfume_id, brand_id, fragrantica_id, name, is_active)"
                        + " VALUES (?, ?, ?, ?, ?)",
                id, brandId, fragranticaId, name, active);
    }

    private void markDiscontinued(long perfumeId) {
        jdbcTemplate.update(
                "UPDATE perfumes SET production_status = 'DISCONTINUED',"
                        + " production_status_checked_at = DATE '2026-10-01',"
                        + " production_status_source = 'https://example.com' WHERE perfume_id = ?",
                perfumeId);
    }

    private void insertImage(long id, long perfumeId, String imageUrl, Integer displayOrder) {
        jdbcTemplate.update(
                "INSERT INTO perfume_images (image_id, perfume_id, image_url, display_order)"
                        + " VALUES (?, ?, ?, ?)",
                id, perfumeId, imageUrl, displayOrder);
    }

    private void clearPerfumeData() {
        jdbcTemplate.update("DELETE FROM perfume_images");
        jdbcTemplate.update("DELETE FROM perfumes");
        jdbcTemplate.update("DELETE FROM brands");
    }

    /**
     * 호출량 제한의 셈을 비웁니다.
     *
     * <p>이 클래스의 테스트가 전부 같은 IP 의 비회원으로 호출합니다. 비우지 않으면 앞선
     * 테스트가 쓴 횟수가 쌓여 뒤쪽 테스트가 429 를 받습니다 — 검증하려던 것과 무관한
     * 이유로 깨집니다. 제한 자체는 {@code RecommendationRateLimitIntegrationTest} 가 봅니다.
     */
    private void clearRateLimit() {
        redisTemplate.delete(redisTemplate.keys("recommendation:rate:*"));
    }
}
