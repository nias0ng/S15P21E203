package com.hyanghae.backend.perfume;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.hyanghae.backend.perfume.exception.PerfumeErrorCode;
import com.hyanghae.backend.support.IntegrationTest;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;

/**
 * 향수 후기 통계와 계절 통계를 실제 PostgreSQL 위에서 검증합니다.
 *
 * <p>고정 데이터는 계절 백분율의 분모 두 가지를 구분할 수 있게 구성했습니다. 봄을 고른 후기가 3개,
 * 계절을 하나라도 고른 후기가 3개, 전체 후기가 5개입니다. 분모가 "계절을 고른 후기 수"면 봄이
 * 100.0, "전체 후기 수"면 60.0 이 됩니다.
 */
@IntegrationTest
@AutoConfigureMockMvc
class PerfumeStatisticsIntegrationTest {

    private static final String REVIEW_STATISTICS_URL = "/api/v1/perfumes/{perfumeId}/review-statistics";
    private static final String SEASON_STATISTICS_URL = "/api/v1/perfumes/{perfumeId}/season-statistics";

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @BeforeEach
    void insertFixtures() {
        clearData();

        insertBrand(1, "Chanel");
        insertPerfume(1, 1, "Bleu de Chanel", true);
        insertPerfume(2, 1, "No Review Scent", true);
        insertPerfume(3, 1, "Retired Scent", false);

        insertSeason(1, "SPRING", "봄");
        insertSeason(2, "SUMMER", "여름");
        insertSeason(3, "AUTUMN", "가을");
        insertSeason(4, "WINTER", "겨울");

        insertReview(100, 1, "PUBLISHED");
        insertReview(101, 1, "PUBLISHED");
        insertReview(102, 1, "PUBLISHED");
        insertReview(103, 1, "PUBLISHED");
        insertReview(104, 1, "HOLD");

        // 100 번은 계절을 두 개 고릅니다. 그래서 백분율의 합이 100 을 넘습니다.
        insertReviewSeason(100, 1);
        insertReviewSeason(100, 3);
        insertReviewSeason(101, 1);
        insertReviewSeason(102, 1);
        // 103, 104 는 계절을 고르지 않았습니다. 분모에 들어가지 않습니다.
    }

    @AfterEach
    void cleanUp() {
        clearData();
    }

    @Test
    void returnsReviewCount() throws Exception {
        mockMvc.perform(get(REVIEW_STATISTICS_URL, 1))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.reviewCount").value(5));
    }

    @Test
    void returnsZeroReviewCountWhenPerfumeHasNoReview() throws Exception {
        mockMvc.perform(get(REVIEW_STATISTICS_URL, 2))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.reviewCount").value(0));
    }

    @Test
    void returnsNotFoundForReviewStatisticsWhenPerfumeDoesNotExist() throws Exception {
        mockMvc.perform(get(REVIEW_STATISTICS_URL, 999))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value(PerfumeErrorCode.PERFUME_NOT_FOUND.code()));
    }

    @Test
    void returnsNotFoundForReviewStatisticsWhenPerfumeIsInactive() throws Exception {
        mockMvc.perform(get(REVIEW_STATISTICS_URL, 3))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value(PerfumeErrorCode.PERFUME_NOT_FOUND.code()));
    }

    /**
     * 보류된 후기도 현재는 통계에 세어집니다. 후기 작성 기능이 없어
     * {@code perfume_reviews.status} 의 값 어휘가 정해지지 않았기 때문입니다.
     * 상태가 정의되어 보류 후기를 제외하면 이 단언이 4 로 바뀌어야 합니다.
     *
     * <p>이 필터는 표시값만의 문제가 아닙니다. 후기 수는 AI 후기 요약을 다시 만들 시점의
     * 기준이고, 요약 명세는 공개 후기만 대상으로 삼습니다. 기준이 어긋나면 요약이 계속
     * 다시 생성되거나 영영 갱신되지 않습니다.
     */
    @Test
    void countsHeldReviewsUntilStatusVocabularyIsDefined() throws Exception {
        mockMvc.perform(get(REVIEW_STATISTICS_URL, 1))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.reviewCount").value(5));
    }

    /**
     * 분모는 계절을 하나라도 고른 후기 수(3)입니다. 전체 후기 수(5)가 아닙니다.
     * 봄을 고른 후기가 3개이므로 봄의 백분율은 100.0 입니다. 전체 후기 수를 분모로 쓰면 60.0 이 됩니다.
     */
    @Test
    void dividesSeasonCountByReviewsThatChoseAnySeason() throws Exception {
        mockMvc.perform(get(SEASON_STATISTICS_URL, 1))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.seasons[0].code").value("SPRING"))
                .andExpect(jsonPath("$.seasons[0].count").value(3))
                .andExpect(jsonPath("$.seasons[0].percentage").value(100.0));
    }

    /** 후기 하나가 계절을 여러 개 고를 수 있어 백분율의 합이 100 을 넘습니다. */
    @Test
    void allowsPercentageSumToExceedOneHundred() throws Exception {
        mockMvc.perform(get(SEASON_STATISTICS_URL, 1))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.seasons[0].percentage").value(100.0))
                .andExpect(jsonPath("$.seasons[2].code").value("AUTUMN"))
                .andExpect(jsonPath("$.seasons[2].count").value(1))
                .andExpect(jsonPath("$.seasons[2].percentage").value(33.3));
    }

    /** 아무도 고르지 않은 계절도 0 으로 포함합니다. 화면이 계절 네 칸을 항상 그립니다. */
    @Test
    void includesSeasonsWithoutAnyReview() throws Exception {
        mockMvc.perform(get(SEASON_STATISTICS_URL, 1))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.seasons.length()").value(4))
                .andExpect(jsonPath("$.seasons[1].code").value("SUMMER"))
                .andExpect(jsonPath("$.seasons[1].count").value(0))
                .andExpect(jsonPath("$.seasons[1].percentage").value(0.0))
                .andExpect(jsonPath("$.seasons[3].code").value("WINTER"))
                .andExpect(jsonPath("$.seasons[3].count").value(0));
    }

    /** 후기가 없는 향수도 모든 계절을 0 으로 내려줍니다. 분모가 0 이라 나눗셈을 하지 않습니다. */
    @Test
    void returnsAllSeasonsAsZeroWhenPerfumeHasNoReview() throws Exception {
        mockMvc.perform(get(SEASON_STATISTICS_URL, 2))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.seasons.length()").value(4))
                .andExpect(jsonPath("$.seasons[0].count").value(0))
                .andExpect(jsonPath("$.seasons[0].percentage").value(0.0));
    }

    @Test
    void returnsNotFoundForSeasonStatisticsWhenPerfumeDoesNotExist() throws Exception {
        mockMvc.perform(get(SEASON_STATISTICS_URL, 999))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value(PerfumeErrorCode.PERFUME_NOT_FOUND.code()));
    }

    @Test
    void returnsNotFoundForSeasonStatisticsWhenPerfumeIsInactive() throws Exception {
        mockMvc.perform(get(SEASON_STATISTICS_URL, 3))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value(PerfumeErrorCode.PERFUME_NOT_FOUND.code()));
    }

    private void insertBrand(long id, String name) {
        jdbcTemplate.update(
                "INSERT INTO brands (brand_id, name, is_active) VALUES (?, ?, true)", id, name);
    }

    private void insertPerfume(long id, long brandId, String name, boolean active) {
        jdbcTemplate.update(
                "INSERT INTO perfumes (perfume_id, brand_id, name, is_active) VALUES (?, ?, ?, ?)",
                id, brandId, name, active);
    }

    private void insertSeason(long id, String code, String name) {
        jdbcTemplate.update(
                "INSERT INTO seasons (season_id, code, name, is_active) VALUES (?, ?, ?, true)",
                id, code, name);
    }

    private void insertReview(long id, long perfumeId, String status) {
        jdbcTemplate.update(
                "INSERT INTO perfume_reviews (id, perfume_id, status) VALUES (?, ?, ?)",
                id, perfumeId, status);
    }

    private void insertReviewSeason(long reviewId, long seasonId) {
        jdbcTemplate.update(
                "INSERT INTO perfume_review_seasons (review_id, season_id) VALUES (?, ?)",
                reviewId, seasonId);
    }

    private void clearData() {
        jdbcTemplate.update("DELETE FROM perfume_review_seasons");
        jdbcTemplate.update("DELETE FROM perfume_reviews");
        jdbcTemplate.update("DELETE FROM seasons");
        jdbcTemplate.update("DELETE FROM perfumes");
        jdbcTemplate.update("DELETE FROM brands");
    }
}
