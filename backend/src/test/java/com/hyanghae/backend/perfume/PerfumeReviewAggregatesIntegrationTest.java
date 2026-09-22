package com.hyanghae.backend.perfume;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.hyanghae.backend.perfume.exception.PerfumeErrorCode;
import com.hyanghae.backend.support.IntegrationTest;
import jakarta.persistence.EntityManagerFactory;
import java.nio.charset.StandardCharsets;
import java.time.OffsetDateTime;
import org.hibernate.SessionFactory;
import org.hibernate.stat.Statistics;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;

/**
 * 후기 집계 4종 일괄 조회를 실제 PostgreSQL 위에서 검증합니다.
 *
 * <p><b>이 테스트의 중심은 동등성입니다.</b> 통합 엔드포인트가 내려주는 네 조각이 기존 네
 * 엔드포인트의 응답과 완전히 같아야 화면이 안전하게 옮겨올 수 있습니다. 그래서 값을 하나씩
 * 적어 두고 비교하는 대신, 두 경로를 모두 호출해 <b>JSON 을 통째로 견줍니다.</b> 값을 적어
 * 두면 집계 규칙이 나중에 바뀔 때 이 테스트도 같이 고쳐야 해서, 두 경로가 함께 틀리는 것을
 * 잡지 못합니다.
 *
 * <p>각 조각이 <i>무엇을</i> 세는지(백분율의 분모, 계절 네 칸, 요약이 없을 때의 모양)는
 * {@link PerfumeStatisticsIntegrationTest} · {@link PerfumeReviewKeywordsIntegrationTest} ·
 * {@link PerfumeReviewSummaryIntegrationTest} 가 이미 검증합니다. 여기서 다시 세지 않습니다.
 *
 * <p>고정 데이터는 네 조각이 모두 <b>비어 있지 않도록</b> 짰습니다. 빈 값끼리는 두 경로가
 * 달라도 똑같이 비어 보여서 동등성 비교가 아무것도 잡지 못합니다.
 */
@IntegrationTest
@AutoConfigureMockMvc
class PerfumeReviewAggregatesIntegrationTest {

    private static final String AGGREGATES_URL = "/api/v1/perfumes/{perfumeId}/review-aggregates";
    private static final String SUMMARY_URL = "/api/v1/perfumes/{perfumeId}/review-summary";
    private static final String KEYWORDS_URL = "/api/v1/perfumes/{perfumeId}/review-keywords";
    private static final String STATISTICS_URL = "/api/v1/perfumes/{perfumeId}/review-statistics";
    private static final String SEASONS_URL = "/api/v1/perfumes/{perfumeId}/season-statistics";

    /** 네 조각이 모두 들어 있는 향수입니다. */
    private static final long FULL = 1;

    /** 존재하지만 집계가 하나도 없는 향수입니다. */
    private static final long EMPTY = 2;

    private static final long INACTIVE = 3;
    private static final long MISSING = 999;

    private static final String UPDATED_AT = "2026-09-05T09:00:00Z";

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private EntityManagerFactory entityManagerFactory;

    @BeforeEach
    void insertFixtures() {
        clearData();

        insertBrand(1, "Chanel");
        insertPerfume(FULL, "Bleu de Chanel", true);
        insertPerfume(EMPTY, "No Review Scent", true);
        insertPerfume(INACTIVE, "Retired Scent", false);

        insertSeason(1, "SPRING", "봄");
        insertSeason(2, "SUMMER", "여름");
        insertSeason(3, "AUTUMN", "가을");
        insertSeason(4, "WINTER", "겨울");

        for (long reviewId = 100; reviewId <= 104; reviewId++) {
            insertReview(reviewId, FULL);
        }

        // 계절을 고른 후기는 셋(100·101·102)입니다. 100 번이 둘을 골라 백분율의 합이 100 을 넘습니다.
        insertReviewSeason(100, 1);
        insertReviewSeason(100, 3);
        insertReviewSeason(101, 1);
        insertReviewSeason(102, 1);

        insertKeyword(1, "warm");
        insertKeyword(2, "fresh");
        insertKeyword(3, "sweet");

        // 키워드가 뽑힌 후기는 넷(100·101·102·103)입니다. 전체 후기 수(5)와 달라야 분모를
        // 잘못 쓰는 실수가 드러납니다.
        linkKeyword(100, 1);
        linkKeyword(100, 2);
        linkKeyword(101, 1);
        linkKeyword(102, 1);
        linkKeyword(103, 3);

        insertSummary(FULL, "시트러스로 시작해 우디로 정착한다는 평이 많습니다.", 5);
    }

    @AfterEach
    void cleanUp() {
        clearData();
    }

    /** 네 조각이 기존 네 엔드포인트의 응답과 같아야 합니다. 화면이 옮겨올 수 있는 근거입니다. */
    @Test
    void returnsSamePayloadAsTheFourSeparateEndpoints() throws Exception {
        JsonNode aggregates = getJson(AGGREGATES_URL, FULL);

        assertThat(aggregates.get("reviewSummary")).isEqualTo(getJson(SUMMARY_URL, FULL));
        assertThat(aggregates.get("reviewKeywords")).isEqualTo(getJson(KEYWORDS_URL, FULL));
        assertThat(aggregates.get("reviewStatistics")).isEqualTo(getJson(STATISTICS_URL, FULL));
        assertThat(aggregates.get("seasonStatistics")).isEqualTo(getJson(SEASONS_URL, FULL));
    }

    /**
     * 집계가 하나도 없는 향수에서도 같아야 합니다.
     *
     * <p>빈 값의 모양이 조각마다 다릅니다 — 키워드는 빈 배열, 계절은 0 으로 채운 네 칸, 요약은
     * 필드가 모두 null 입니다. 한 경로만 이것을 뭉개면 화면이 옮겨올 때 깨집니다.
     */
    @Test
    void returnsSamePayloadWhenPerfumeHasNoAggregates() throws Exception {
        JsonNode aggregates = getJson(AGGREGATES_URL, EMPTY);

        assertThat(aggregates.get("reviewSummary")).isEqualTo(getJson(SUMMARY_URL, EMPTY));
        assertThat(aggregates.get("reviewKeywords")).isEqualTo(getJson(KEYWORDS_URL, EMPTY));
        assertThat(aggregates.get("reviewStatistics")).isEqualTo(getJson(STATISTICS_URL, EMPTY));
        assertThat(aggregates.get("seasonStatistics")).isEqualTo(getJson(SEASONS_URL, EMPTY));
    }

    /** 네 조각이 모두 들어 있어야 합니다. 하나라도 빠지면 화면이 그 칸을 못 그립니다. */
    @Test
    void containsAllFourParts() throws Exception {
        mockMvc.perform(get(AGGREGATES_URL, FULL))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.reviewSummary").exists())
                .andExpect(jsonPath("$.reviewKeywords.keywords").isArray())
                .andExpect(jsonPath("$.reviewStatistics.reviewCount").value(5))
                .andExpect(jsonPath("$.seasonStatistics.seasons.length()").value(4));
    }

    /**
     * {@code size} 는 키워드 개수만 자릅니다.
     *
     * <p>백분율은 그대로여야 합니다. 분모가 "키워드가 하나라도 뽑힌 후기 수"로 따로 세어지므로
     * 잘린 목록에서 다시 세면 안 됩니다. warm 은 넷 중 셋에 나와 75.0 이고, 한 개만 받아도
     * 75.0 이어야 합니다.
     */
    @Test
    void limitsOnlyKeywordsWithSize() throws Exception {
        mockMvc.perform(get(AGGREGATES_URL, FULL).param("size", "1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.reviewKeywords.keywords.length()").value(1))
                .andExpect(jsonPath("$.reviewKeywords.keywords[0].keyword").value("warm"))
                .andExpect(jsonPath("$.reviewKeywords.keywords[0].percentage").value(75.0))
                .andExpect(jsonPath("$.reviewStatistics.reviewCount").value(5))
                .andExpect(jsonPath("$.seasonStatistics.seasons.length()").value(4));
    }

    /** 요약이 없는 향수는 404 가 아니라 필드가 모두 null 입니다. 없는 향수와 구분해야 합니다. */
    @Test
    void returnsNullSummaryFieldsWhenSummaryIsMissing() throws Exception {
        mockMvc.perform(get(AGGREGATES_URL, EMPTY))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.reviewSummary").exists())
                .andExpect(jsonPath("$.reviewSummary.summary").doesNotExist())
                .andExpect(jsonPath("$.reviewSummary.sourceReviewCount").doesNotExist())
                .andExpect(jsonPath("$.reviewSummary.updatedAt").doesNotExist());
    }

    /**
     * 합친 이유가 요청 수·쿼리 수를 줄이는 것이므로, 실제로 줄었는지를 셉니다.
     *
     * <p>값만 보는 테스트는 통합 엔드포인트가 속으로 기존 넷을 그대로 부르도록 되돌려도
     * 통과합니다. CollectionPreviewThumbnailIntegrationTest 가 N+1 을 막을 때 쓴
     * 방법과 같습니다.
     *
     * <p>개수를 정확히 못 박습니다. 범위로 두면 존재 확인이 다시 네 번이 되어도 통과합니다.
     *
     * <ul>
     *   <li>따로 부를 때 10 — 존재 확인 4(같은 값을 네 번) + 요약 1 + 키워드 2 + 후기 수 1
     *       + 계절 2
     *   <li>합쳐 부를 때 7 — 존재 확인 1 + 나머지 6
     * </ul>
     *
     * <p>트랜잭션도 넷에서 하나로 줄어듭니다. 부하 테스트에서 이 화면이 10 VU 만에 포화한 것이
     * 화면 한 장에 트랜잭션이 넷씩 열렸기 때문입니다.
     */
    @Test
    void runsFewerStatementsInOneTransaction() throws Exception {
        Counted separate = count(() -> {
            mockMvc.perform(get(SUMMARY_URL, FULL)).andExpect(status().isOk());
            mockMvc.perform(get(KEYWORDS_URL, FULL)).andExpect(status().isOk());
            mockMvc.perform(get(STATISTICS_URL, FULL)).andExpect(status().isOk());
            mockMvc.perform(get(SEASONS_URL, FULL)).andExpect(status().isOk());
        });
        Counted merged = count(() ->
                mockMvc.perform(get(AGGREGATES_URL, FULL)).andExpect(status().isOk()));

        // 통계가 꺼져 있으면 둘 다 0 이라 아래 비교가 저절로 통과합니다. 세고 있다는 것부터
        // 확인해야 이 테스트가 의미를 가집니다.
        assertThat(separate.statements)
                .as("쿼리를 실제로 세고 있어야 합니다")
                .isEqualTo(10);
        assertThat(merged.statements)
                .as("합쳐 부르면 존재 확인이 한 번이라 7 이어야 합니다 (실제 %d)", merged.statements)
                .isEqualTo(7);
        assertThat(separate.transactions)
                .as("따로 부르면 트랜잭션이 넷입니다 (실제 %d)", separate.transactions)
                .isEqualTo(4);
        assertThat(merged.transactions)
                .as("합쳐 부르면 트랜잭션이 하나여야 합니다 (실제 %d)", merged.transactions)
                .isEqualTo(1);
    }

    @Test
    void returnsNotFoundWhenPerfumeDoesNotExist() throws Exception {
        mockMvc.perform(get(AGGREGATES_URL, MISSING))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value(PerfumeErrorCode.PERFUME_NOT_FOUND.code()));
    }

    @Test
    void returnsNotFoundWhenPerfumeIsInactive() throws Exception {
        mockMvc.perform(get(AGGREGATES_URL, INACTIVE))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value(PerfumeErrorCode.PERFUME_NOT_FOUND.code()));
    }

    /** 한 번의 측정에서 나간 SQL 문 수와 트랜잭션 수입니다. */
    private record Counted(long statements, long transactions) {
    }

    /** 검사 예외를 던질 수 있는 측정 대상입니다. 람다로 넘기려고 따로 둡니다. */
    @FunctionalInterface
    private interface Measured {
        void run() throws Exception;
    }

    private Counted count(Measured measured) throws Exception {
        Statistics statistics = entityManagerFactory.unwrap(SessionFactory.class).getStatistics();
        statistics.setStatisticsEnabled(true);
        statistics.clear();

        measured.run();

        return new Counted(statistics.getPrepareStatementCount(), statistics.getTransactionCount());
    }

    private JsonNode getJson(String url, long perfumeId) throws Exception {
        String body = mockMvc.perform(get(url, perfumeId))
                .andExpect(status().isOk())
                .andReturn()
                .getResponse()
                .getContentAsString(StandardCharsets.UTF_8);
        return objectMapper.readTree(body);
    }

    private void insertBrand(long id, String name) {
        jdbcTemplate.update(
                "INSERT INTO brands (brand_id, name, is_active) VALUES (?, ?, true)", id, name);
    }

    private void insertPerfume(long id, String name, boolean active) {
        jdbcTemplate.update(
                "INSERT INTO perfumes (perfume_id, brand_id, name, is_active) VALUES (?, 1, ?, ?)",
                id, name, active);
    }

    private void insertSeason(long id, String code, String name) {
        jdbcTemplate.update(
                "INSERT INTO seasons (season_id, code, name, is_active) VALUES (?, ?, ?, true)",
                id, code, name);
    }

    private void insertReview(long id, long perfumeId) {
        jdbcTemplate.update(
                "INSERT INTO perfume_reviews (id, perfume_id) VALUES (?, ?)", id, perfumeId);
    }

    private void insertReviewSeason(long reviewId, long seasonId) {
        jdbcTemplate.update(
                "INSERT INTO perfume_review_seasons (review_id, season_id) VALUES (?, ?)",
                reviewId, seasonId);
    }

    private void insertKeyword(long id, String name) {
        jdbcTemplate.update(
                "INSERT INTO review_keywords (keyword_id, name) VALUES (?, ?)", id, name);
    }

    private void linkKeyword(long reviewId, long keywordId) {
        jdbcTemplate.update(
                "INSERT INTO perfume_review_keywords (review_id, keyword_id) VALUES (?, ?)",
                reviewId, keywordId);
    }

    private void insertSummary(long perfumeId, String summaryText, int sourceReviewCount) {
        jdbcTemplate.update(
                "INSERT INTO perfume_review_summaries (perfume_id, summary_text, source_review_count,"
                        + " created_at, updated_at) VALUES (?, ?, ?, ?, ?)",
                perfumeId, summaryText, sourceReviewCount,
                OffsetDateTime.parse(UPDATED_AT), OffsetDateTime.parse(UPDATED_AT));
    }

    private void clearData() {
        jdbcTemplate.update("DELETE FROM perfume_review_summaries");
        jdbcTemplate.update("DELETE FROM perfume_review_keywords");
        jdbcTemplate.update("DELETE FROM review_keywords");
        jdbcTemplate.update("DELETE FROM perfume_review_seasons");
        jdbcTemplate.update("DELETE FROM perfume_reviews");
        jdbcTemplate.update("DELETE FROM seasons");
        jdbcTemplate.update("DELETE FROM perfumes");
        jdbcTemplate.update("DELETE FROM brands");
    }
}
