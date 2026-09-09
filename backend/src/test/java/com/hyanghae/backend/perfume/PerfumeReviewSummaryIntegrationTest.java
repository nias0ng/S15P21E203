package com.hyanghae.backend.perfume;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.hyanghae.backend.perfume.exception.PerfumeErrorCode;
import com.hyanghae.backend.support.IntegrationTest;
import java.time.OffsetDateTime;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;

/**
 * AI 후기 요약 조회를 실제 PostgreSQL 위에서 검증합니다.
 *
 * <p>요약을 생성하는 파이프라인이 아직 없어 운영 데이터로는 빈 응답만 확인할 수 있습니다.
 * 요약이 있는 경우는 이 테스트가 고정 데이터로 검증합니다.
 */
@IntegrationTest
@AutoConfigureMockMvc
class PerfumeReviewSummaryIntegrationTest {

    private static final String SUMMARY_URL = "/api/v1/perfumes/{perfumeId}/review-summary";

    private static final String SUMMARY_TEXT =
            "시트러스로 시작해 우디로 정착한다는 평이 많습니다. 지속력이 아쉽다는 의견도 있습니다.";
    private static final String UPDATED_AT = "2026-09-05T09:00:00Z";

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @BeforeEach
    void insertFixtures() {
        clearData();

        insertBrand(1, "Chanel");
        insertPerfume(1, 1, "Bleu de Chanel", true);
        insertPerfume(2, 1, "No Summary Scent", true);
        insertPerfume(3, 1, "Retired Scent", false);

        insertSummary(1, SUMMARY_TEXT, 42);
    }

    @AfterEach
    void cleanUp() {
        clearData();
    }

    @Test
    void returnsSummary() throws Exception {
        mockMvc.perform(get(SUMMARY_URL, 1))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.summary").value(SUMMARY_TEXT))
                .andExpect(jsonPath("$.sourceReviewCount").value(42))
                .andExpect(jsonPath("$.updatedAt").value(UPDATED_AT));
    }

    /** 요약이 없는 향수는 필드가 모두 null 인 200 입니다. 404 로 하면 향수가 없는 경우와 구분되지 않습니다. */
    @Test
    void returnsNullFieldsWhenSummaryDoesNotExist() throws Exception {
        mockMvc.perform(get(SUMMARY_URL, 2))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.summary").doesNotExist())
                .andExpect(jsonPath("$.sourceReviewCount").doesNotExist())
                .andExpect(jsonPath("$.updatedAt").doesNotExist());
    }

    @Test
    void returnsNotFoundWhenPerfumeDoesNotExist() throws Exception {
        mockMvc.perform(get(SUMMARY_URL, 999))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value(PerfumeErrorCode.PERFUME_NOT_FOUND.code()));
    }

    @Test
    void returnsNotFoundForInactivePerfume() throws Exception {
        mockMvc.perform(get(SUMMARY_URL, 3))
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

    private void insertSummary(long perfumeId, String summaryText, int sourceReviewCount) {
        jdbcTemplate.update(
                "INSERT INTO perfume_review_summaries (perfume_id, summary_text, source_review_count,"
                        + " created_at, updated_at) VALUES (?, ?, ?, ?, ?)",
                perfumeId, summaryText, sourceReviewCount,
                OffsetDateTime.parse(UPDATED_AT), OffsetDateTime.parse(UPDATED_AT));
    }

    private void clearData() {
        jdbcTemplate.update("DELETE FROM perfume_review_summaries");
        jdbcTemplate.update("DELETE FROM perfumes");
        jdbcTemplate.update("DELETE FROM brands");
    }
}
