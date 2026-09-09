package com.hyanghae.backend.perfume;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.hyanghae.backend.perfume.exception.PerfumeErrorCode;
import com.hyanghae.backend.support.IntegrationTest;
import org.hamcrest.Matchers;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;

/**
 * 후기 키워드 통계를 실제 PostgreSQL 위에서 검증합니다.
 *
 * <p>고정 데이터는 분모 두 가지를 구분할 수 있게 구성했습니다. 향수 1 의 후기는 5건이고 그중
 * 키워드가 뽑힌 후기는 3건입니다. "달콤한"은 그 3건 모두에 나오므로, 분모가 "키워드가 뽑힌 후기
 * 수"면 100.0, "전체 후기 수"면 60.0 이 됩니다.
 *
 * <p>후기 100 번은 키워드를 두 개 갖습니다. 그래서 백분율의 합이 100 을 넘습니다.
 */
@IntegrationTest
@AutoConfigureMockMvc
class PerfumeReviewKeywordsIntegrationTest {

    private static final String KEYWORDS_URL = "/api/v1/perfumes/{perfumeId}/review-keywords";

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @BeforeEach
    void insertFixtures() {
        clearData();

        insertBrand(1, "Chanel");
        insertPerfume(1, "Base Scent", true);
        insertPerfume(2, "Scent Without Review", true);
        insertPerfume(3, "Retired Scent", false);

        for (int i = 0; i < 5; i++) {
            insertReview(100 + i, 1);
        }

        insertKeyword(1, "달콤한");
        insertKeyword(2, "시원한");
        insertKeyword(3, "포근한");

        // 키워드가 뽑힌 후기는 100, 101, 102 세 건입니다. 103·104 는 분석되지 않았습니다.
        linkKeyword(100, 1);
        linkKeyword(100, 2);
        linkKeyword(101, 1);
        linkKeyword(102, 1);
    }

    @AfterEach
    void cleanUp() {
        clearData();
    }

    /**
     * 분모는 키워드가 뽑힌 후기 수(3)입니다. 전체 후기 수(5)가 아닙니다. "달콤한"이 3건 모두에
     * 나오므로 100.0 입니다. 전체 후기 수를 분모로 쓰면 60.0 이 됩니다.
     */
    @Test
    void dividesKeywordCountByReviewsThatHaveAnyKeyword() throws Exception {
        mockMvc.perform(get(KEYWORDS_URL, 1))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.keywords[0].keyword").value("달콤한"))
                .andExpect(jsonPath("$.keywords[0].percentage").value(100.0));
    }

    /** 많이 나온 순입니다. 화면이 앞에서 몇 개만 잘라 쓸 수 있어야 합니다. */
    @Test
    void ordersKeywordsByMentionCountDescending() throws Exception {
        mockMvc.perform(get(KEYWORDS_URL, 1))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.keywords", Matchers.hasSize(2)))
                .andExpect(jsonPath("$.keywords[0].keyword").value("달콤한"))
                .andExpect(jsonPath("$.keywords[1].keyword").value("시원한"));
    }

    /** 후기 하나에서 키워드가 여러 개 나올 수 있어 합이 100 을 넘습니다. */
    @Test
    void allowsPercentageSumToExceedOneHundred() throws Exception {
        mockMvc.perform(get(KEYWORDS_URL, 1))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.keywords[0].percentage").value(100.0))
                .andExpect(jsonPath("$.keywords[1].percentage").value(33.3));
    }

    /** 아무 후기에도 나오지 않은 키워드는 0 으로 채우지 않고 아예 빼야 합니다. */
    @Test
    void omitsKeywordsThatNoReviewMentioned() throws Exception {
        mockMvc.perform(get(KEYWORDS_URL, 1))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.keywords[*].keyword",
                        Matchers.not(Matchers.hasItem("포근한"))));
    }

    /** 키워드가 하나도 없는 향수는 빈 배열입니다. 없는 향수와 구분해야 합니다. */
    @Test
    void returnsEmptyListWhenPerfumeHasNoKeyword() throws Exception {
        mockMvc.perform(get(KEYWORDS_URL, 2))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.keywords", Matchers.hasSize(0)));
    }

    @Test
    void returnsNotFoundWhenPerfumeDoesNotExist() throws Exception {
        mockMvc.perform(get(KEYWORDS_URL, 999))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value(PerfumeErrorCode.PERFUME_NOT_FOUND.code()));
    }

    @Test
    void returnsNotFoundForInactivePerfume() throws Exception {
        mockMvc.perform(get(KEYWORDS_URL, 3))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value(PerfumeErrorCode.PERFUME_NOT_FOUND.code()));
    }

    private void insertBrand(long id, String name) {
        jdbcTemplate.update(
                "INSERT INTO brands (brand_id, name, is_active) VALUES (?, ?, true)", id, name);
    }

    private void insertPerfume(long id, String name, boolean active) {
        jdbcTemplate.update(
                "INSERT INTO perfumes (perfume_id, brand_id, name, is_active)"
                        + " VALUES (?, 1, ?, ?)",
                id, name, active);
    }

    private void insertReview(long id, long perfumeId) {
        jdbcTemplate.update(
                "INSERT INTO perfume_reviews (id, perfume_id) VALUES (?, ?)", id, perfumeId);
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

    private void clearData() {
        jdbcTemplate.update("DELETE FROM perfume_review_keywords");
        jdbcTemplate.update("DELETE FROM review_keywords");
        jdbcTemplate.update("DELETE FROM perfume_reviews");
        jdbcTemplate.update("DELETE FROM perfumes");
        jdbcTemplate.update("DELETE FROM brands");
    }
}
