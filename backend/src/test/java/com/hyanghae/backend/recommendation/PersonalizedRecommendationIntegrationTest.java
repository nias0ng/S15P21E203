package com.hyanghae.backend.recommendation;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.hyanghae.backend.global.security.CurrentUser;
import com.hyanghae.backend.support.IntegrationTest;
import java.sql.Timestamp;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Optional;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.context.annotation.Primary;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;

@IntegrationTest
@AutoConfigureMockMvc
@Import(PersonalizedRecommendationIntegrationTest.FakeCurrentUserConfig.class)
class PersonalizedRecommendationIntegrationTest {

    private static final String URL = "/api/v1/recommendations/personalized";
    private static final long USER_ID = 91001L;
    private static final long TASTE_PERFUME = 92001L;
    private static final long FIRST_CANDIDATE = 92002L;
    private static final long SECOND_CANDIDATE = 92003L;
    private static final long ACCORD_ID = 93001L;

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Autowired
    private FakeCurrentUser currentUser;

    @BeforeEach
    void setUp() {
        clearData();
        currentUser.id = USER_ID;

        jdbcTemplate.update(
                "INSERT INTO users (user_id, email, password_hash, nickname) VALUES (?, ?, 'x', ?)",
                USER_ID, "personalized@hyanghae.test", "추천사용자");
        jdbcTemplate.update(
                "INSERT INTO accords (accord_id, name, is_active) VALUES (?, 'woody', TRUE)",
                ACCORD_ID);
        insertPerfume(TASTE_PERFUME, "Taste Origin");
        insertPerfume(FIRST_CANDIDATE, "First Candidate");
        insertPerfume(SECOND_CANDIDATE, "Second Candidate");
        insertAccord(TASTE_PERFUME, 1.0);
        insertAccord(FIRST_CANDIDATE, 0.9);
        insertAccord(SECOND_CANDIDATE, 0.8);

        Long userTestId = jdbcTemplate.queryForObject(
                "INSERT INTO user_taste_tests (user_id, matched_perfume_id, completed_at) "
                        + "VALUES (?, ?, NOW()) RETURNING user_test_id",
                Long.class,
                USER_ID, TASTE_PERFUME);
        Long woodyRegionId = jdbcTemplate.queryForObject(
                "SELECT scent_region_id FROM scent_regions WHERE code = 'WOODY'",
                Long.class);
        jdbcTemplate.update(
                "INSERT INTO user_taste_test_selections "
                        + "(user_test_id, scent_region_id, pick_order) VALUES (?, ?, 1)",
                userTestId,
                woodyRegionId);
        insertFamily(FIRST_CANDIDATE, woodyRegionId, 0.9);
        insertFamily(SECOND_CANDIDATE, woodyRegionId, 0.8);
        // 취향 테스트에서 이미 본 결과 향수는 보유 상태로 두어 신규 추천 후보에서 제외합니다.
        jdbcTemplate.update(
                "INSERT INTO user_perfumes "
                        + "(user_id, perfume_id, ownership_status, is_representative) "
                        + "VALUES (?, ?, 'OWNED', FALSE)",
                USER_ID, TASTE_PERFUME);
        jdbcTemplate.update(
                "INSERT INTO perfume_images "
                        + "(perfume_id, image_url, display_order, image_type) "
                        + "VALUES (?, 'https://images.test/first.png', 1, 'ORIGINAL')",
                FIRST_CANDIDATE);
    }

    @AfterEach
    void tearDown() {
        clearData();
    }

    @Test
    void recommendsOnePerfumeAndRecordsExposure() throws Exception {
        // 두 번째 후보를 최근에 보여 줬으므로 첫 번째 후보만 3일 제한을 통과합니다.
        insertExposure(SECOND_CANDIDATE, Instant.now().minus(1, ChronoUnit.DAYS));

        mockMvc.perform(get(URL))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.recommendation.perfumeId").value((int) FIRST_CANDIDATE))
                .andExpect(jsonPath("$.recommendation.name").value("First Candidate"))
                .andExpect(jsonPath("$.recommendation.imageUrl")
                        .value("https://images.test/first.png"))
                .andExpect(jsonPath("$.recommendation.reason")
                        .value("취향 테스트에서 선택한 우디 계열과 잘 맞아요."))
                .andExpect(jsonPath("$.recommendation.mapPoint").doesNotExist());

        Integer exposures = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM personalized_recommendation_exposures "
                        + "WHERE user_id = ? AND perfume_id = ?",
                Integer.class,
                USER_ID,
                FIRST_CANDIDATE);
        assertThat(exposures).isEqualTo(1);
    }

    @Test
    void returnsTheOldestExposureWhenEveryTopCandidateIsInCooldown() throws Exception {
        insertExposure(FIRST_CANDIDATE, Instant.now().minus(2, ChronoUnit.DAYS));
        insertExposure(SECOND_CANDIDATE, Instant.now().minus(1, ChronoUnit.DAYS));

        mockMvc.perform(get(URL))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.recommendation.perfumeId").value((int) FIRST_CANDIDATE));
    }

    @Test
    void usesFitRatingAsTheStrongerReason() throws Exception {
        jdbcTemplate.update(
                "UPDATE user_perfumes SET fit_rating = 5.0 "
                        + "WHERE user_id = ? AND perfume_id = ?",
                USER_ID,
                TASTE_PERFUME);
        insertExposure(SECOND_CANDIDATE, Instant.now().minus(1, ChronoUnit.DAYS));

        mockMvc.perform(get(URL))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.recommendation.perfumeId").value((int) FIRST_CANDIDATE))
                .andExpect(jsonPath("$.recommendation.reason")
                        .value("높게 평가한 향수와 woody 어코드가 비슷해요."));
    }

    @Test
    void recommendsFromRecentViewsWithoutTasteTest() throws Exception {
        jdbcTemplate.update("DELETE FROM user_taste_tests WHERE user_id = ?", USER_ID);
        jdbcTemplate.update(
                "INSERT INTO user_perfume_views "
                        + "(user_id, perfume_id, from_location_type, viewed_at) "
                        + "VALUES (?, ?, 'DIRECT', NOW())",
                USER_ID,
                TASTE_PERFUME);
        insertExposure(SECOND_CANDIDATE, Instant.now().minus(1, ChronoUnit.DAYS));

        mockMvc.perform(get(URL))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.recommendation.perfumeId").value((int) FIRST_CANDIDATE))
                .andExpect(jsonPath("$.recommendation.reason")
                        .value("최근 살펴본 향수에서 자주 만난 woody 어코드를 담고 있어요."));
    }

    @Test
    void requiresLogin() throws Exception {
        currentUser.id = null;

        mockMvc.perform(get(URL))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("RECOMMENDATION_LOGIN_REQUIRED"));
    }

    @Test
    void returnsNotFoundWhenThereIsNoPreferenceSignal() throws Exception {
        jdbcTemplate.update("DELETE FROM user_taste_tests WHERE user_id = ?", USER_ID);

        mockMvc.perform(get(URL))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("RECOMMENDATION_NOT_FOUND"));
    }

    private void insertPerfume(long perfumeId, String name) {
        jdbcTemplate.update(
                "INSERT INTO perfumes (perfume_id, name, is_active) VALUES (?, ?, TRUE)",
                perfumeId,
                name);
    }

    private void insertAccord(long perfumeId, double weight) {
        jdbcTemplate.update(
                "INSERT INTO perfume_accords (perfume_id, accord_id, rank, weight) "
                        + "VALUES (?, ?, 1, ?)",
                perfumeId,
                ACCORD_ID,
                weight);
    }

    private void insertFamily(long perfumeId, long scentRegionId, double weight) {
        jdbcTemplate.update(
                "INSERT INTO perfume_scent_families (perfume_id, scent_region_id, weight) "
                        + "VALUES (?, ?, ?)",
                perfumeId,
                scentRegionId,
                weight);
    }

    private void insertExposure(long perfumeId, Instant recommendedAt) {
        jdbcTemplate.update(
                "INSERT INTO personalized_recommendation_exposures "
                        + "(user_id, perfume_id, recommended_at) VALUES (?, ?, ?)",
                USER_ID,
                perfumeId,
                Timestamp.from(recommendedAt));
    }

    private void clearData() {
        jdbcTemplate.update("DELETE FROM personalized_recommendation_exposures WHERE user_id = ?", USER_ID);
        jdbcTemplate.update("DELETE FROM user_perfume_views WHERE user_id = ?", USER_ID);
        jdbcTemplate.update("DELETE FROM user_perfumes WHERE user_id = ?", USER_ID);
        jdbcTemplate.update("DELETE FROM user_taste_tests WHERE user_id = ?", USER_ID);
        jdbcTemplate.update("DELETE FROM perfume_images WHERE perfume_id IN (?, ?, ?)",
                TASTE_PERFUME, FIRST_CANDIDATE, SECOND_CANDIDATE);
        jdbcTemplate.update("DELETE FROM perfume_scent_families WHERE perfume_id IN (?, ?, ?)",
                TASTE_PERFUME, FIRST_CANDIDATE, SECOND_CANDIDATE);
        jdbcTemplate.update("DELETE FROM perfume_accords WHERE perfume_id IN (?, ?, ?)",
                TASTE_PERFUME, FIRST_CANDIDATE, SECOND_CANDIDATE);
        jdbcTemplate.update("DELETE FROM perfumes WHERE perfume_id IN (?, ?, ?)",
                TASTE_PERFUME, FIRST_CANDIDATE, SECOND_CANDIDATE);
        jdbcTemplate.update("DELETE FROM accords WHERE accord_id = ?", ACCORD_ID);
        jdbcTemplate.update("DELETE FROM users WHERE user_id = ?", USER_ID);
    }

    @TestConfiguration
    static class FakeCurrentUserConfig {

        @Bean
        @Primary
        FakeCurrentUser fakeCurrentUser() {
            return new FakeCurrentUser();
        }
    }

    static class FakeCurrentUser implements CurrentUser {

        private Long id;

        @Override
        public Optional<Long> id() {
            return Optional.ofNullable(id);
        }
    }
}
