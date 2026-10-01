package com.hyanghae.backend.recommendation;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.nullValue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.hyanghae.backend.global.security.CurrentUser;
import com.hyanghae.backend.recommendation.repository.PersonalizedRecommendationCandidate;
import com.hyanghae.backend.recommendation.repository.PersonalizedRecommendationRepository;
import com.hyanghae.backend.support.IntegrationTest;
import java.nio.charset.StandardCharsets;
import java.sql.Timestamp;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.context.annotation.Primary;
import org.springframework.core.io.ClassPathResource;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

@IntegrationTest
@AutoConfigureMockMvc
@Import(PersonalizedRecommendationIntegrationTest.FakeCurrentUserConfig.class)
class PersonalizedRecommendationIntegrationTest {

    private static final String URL = "/api/v1/recommendations/personalized";
    private static final long USER_ID = 91001L;
    private static final long OTHER_USER_ID = 91002L;
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

    @Autowired
    private PersonalizedRecommendationRepository recommendationRepository;

    @Autowired
    private PlatformTransactionManager transactionManager;

    @ParameterizedTest
    @ValueSource(ints = {0, 1, 3, 5})
    void preservesDeployedCandidatesScoresAndEvidence(int rating) throws Exception {
        Long regionId = jdbcTemplate.queryForObject(
                "SELECT scent_region_id FROM scent_regions WHERE code = 'WOODY'", Long.class);
        // 10개 제한과 동일 점수일 때 perfume_id 정렬까지 비교합니다.
        for (long perfumeId = 92100; perfumeId < 92112; perfumeId++) {
            insertPerfume(perfumeId, "Extra Candidate " + perfumeId);
            insertFamily(perfumeId, regionId, 1.0);
        }
        if (rating != 0) {
            jdbcTemplate.update("UPDATE user_perfumes SET fit_rating = ? WHERE user_id = ?",
                    rating, USER_ID);
        }
        jdbcTemplate.update("INSERT INTO user_perfume_views (user_id, perfume_id, viewed_at) "
                + "VALUES (?, ?, NOW() - INTERVAL '1 day')", USER_ID, TASTE_PERFUME);
        insertExposure(FIRST_CANDIDATE, Instant.now().minus(1, ChronoUnit.DAYS));

        String baseline = new ClassPathResource("recommendation/personalized-baseline.sql")
                .getContentAsString(StandardCharsets.UTF_8);
        // NOW() 기반 감쇠를 두 SQL에서 동일하게 비교하기 위해 한 트랜잭션으로 실행합니다.
        new TransactionTemplate(transactionManager).executeWithoutResult(status -> {
            var jdbc = new NamedParameterJdbcTemplate(jdbcTemplate);
            List<PersonalizedRecommendationCandidate> expected = jdbc.query(baseline,
                    Map.of("userId", USER_ID, "limit", 10),
                    (rs, rowNum) -> new PersonalizedRecommendationCandidate(
                            rs.getLong("perfume_id"), rs.getString("display_name"),
                            null, null,
                            rs.getString("image_url"), rs.getDouble("score"),
                            rs.getString("evidence_source"), rs.getString("evidence_name"),
                            null,
                            rs.getObject("last_recommended_at", java.time.OffsetDateTime.class)));
            var actual = recommendationRepository.findTopCandidates(USER_ID, 10);
            assertThat(actual).hasSize(expected.size());
            for (int i = 0; i < expected.size(); i++) {
                // 원래 이름 · 근거 키는 기준 SQL 에 없던 값이라 비교에서 뺍니다.
                assertThat(actual.get(i)).usingRecursiveComparison()
                        .ignoringFields("originalName", "nameKo", "evidenceKey")
                        .withComparatorForType((a, b) -> Math.abs(a - b) < 1e-12
                                ? 0 : Double.compare(a, b), Double.class)
                        .isEqualTo(expected.get(i));
            }
            assertThat(actual).hasSize(10);
        });
    }

    @Test
    void usesRecentEvidenceWithAllCandidateAccordsInTheNorm() {
        jdbcTemplate.update("DELETE FROM perfume_scent_families WHERE perfume_id = ?",
                FIRST_CANDIDATE);
        jdbcTemplate.update("INSERT INTO accords (accord_id, name, is_active) "
                + "VALUES (?, 'unmatched', TRUE)", ACCORD_ID + 1);
        jdbcTemplate.update("INSERT INTO perfume_accords (perfume_id, accord_id, rank, weight) "
                + "VALUES (?, ?, 2, 0.8)", FIRST_CANDIDATE, ACCORD_ID + 1);
        jdbcTemplate.update("INSERT INTO user_perfume_views (user_id, perfume_id, viewed_at) "
                + "VALUES (?, ?, NOW())", USER_ID, TASTE_PERFUME);

        var candidate = recommendationRepository.findTopCandidates(USER_ID, 10).stream()
                .filter(value -> value.perfumeId() == FIRST_CANDIDATE).findFirst().orElseThrow();
        assertThat(candidate.evidenceSource()).isEqualTo("RECENT");
        assertThat(candidate.evidenceName()).isEqualTo("woody");
        assertThat(candidate.evidenceKey()).isEqualTo("woody");
        // 0.9 / sqrt(0.9² + 0.8²) * 0.15
        double expectedScore = 0.9 / Math.sqrt(0.9 * 0.9 + 0.8 * 0.8) * 0.15;
        assertThat(candidate.score()).isCloseTo(expectedScore,
                org.assertj.core.data.Offset.offset(1e-12));
    }

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
    void recommendsOnePerfumeWithoutRecordingExposureUntilCompletion() throws Exception {
        // 두 번째 후보를 최근에 보여 줬으므로 첫 번째 후보만 3일 제한을 통과합니다.
        insertExposure(SECOND_CANDIDATE, Instant.now().minus(1, ChronoUnit.DAYS));

        mockMvc.perform(get(URL))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.recommendationToken").isString())
                .andExpect(jsonPath("$.recommendation.perfumeId").value((int) FIRST_CANDIDATE))
                .andExpect(jsonPath("$.recommendation.name").value("First Candidate"))
                .andExpect(jsonPath("$.recommendation.imageUrl")
                        .value("https://images.test/first.png"))
                .andExpect(jsonPath("$.recommendation.reason")
                        .value("취향 테스트에서 선택한 우디 계열과 잘 맞아요."))
                .andExpect(jsonPath("$.recommendation.originalName").value("First Candidate"))
                .andExpect(jsonPath("$.recommendation.nameKo").value(nullValue()))
                .andExpect(jsonPath("$.recommendation.evidenceSource").value("TASTE_TEST"))
                .andExpect(jsonPath("$.recommendation.evidenceKey").value("WOODY"));

        Integer exposuresBeforeCompletion = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM personalized_recommendation_exposures "
                        + "WHERE user_id = ? AND perfume_id = ?",
                Integer.class,
                USER_ID,
                FIRST_CANDIDATE);
        assertThat(exposuresBeforeCompletion).isZero();

        UUID token = jdbcTemplate.queryForObject(
                "SELECT recommendation_token FROM personalized_recommendation_offers "
                        + "WHERE user_id = ?",
                UUID.class,
                USER_ID);
        mockMvc.perform(post(URL + "/" + token + "/exposure"))
                .andExpect(status().isNoContent());
        mockMvc.perform(post(URL + "/" + token + "/exposure"))
                .andExpect(status().isNoContent());

        Integer exposuresAfterCompletion = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM personalized_recommendation_exposures "
                        + "WHERE user_id = ? AND perfume_id = ?",
                Integer.class,
                USER_ID,
                FIRST_CANDIDATE);
        assertThat(exposuresAfterCompletion).isEqualTo(1);
    }

    /** 영어 요청이면 이유가 영어 문장이고, 이름은 한국어 우선 그대로 두고 원래 이름을 따로 줍니다. */
    @Test
    void writesEnglishReasonForEnglishRequest() throws Exception {
        insertExposure(SECOND_CANDIDATE, Instant.now().minus(1, ChronoUnit.DAYS));
        jdbcTemplate.update("UPDATE perfumes SET name_ko = '첫 후보' WHERE perfume_id = ?",
                FIRST_CANDIDATE);

        mockMvc.perform(get(URL).header("Accept-Language", "en"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.recommendation.perfumeId").value((int) FIRST_CANDIDATE))
                .andExpect(jsonPath("$.recommendation.name").value("첫 후보"))
                .andExpect(jsonPath("$.recommendation.originalName").value("First Candidate"))
                .andExpect(jsonPath("$.recommendation.nameKo").value("첫 후보"))
                .andExpect(jsonPath("$.recommendation.evidenceSource").value("TASTE_TEST"))
                .andExpect(jsonPath("$.recommendation.evidenceKey").value("WOODY"))
                .andExpect(jsonPath("$.recommendation.reason").value(
                        "It suits the Woody scent family you picked in the Taste Test."));
    }

    @Test
    void writesEnglishFitReasonWithAccordName() throws Exception {
        jdbcTemplate.update(
                "UPDATE user_perfumes SET fit_rating = 5.0 "
                        + "WHERE user_id = ? AND perfume_id = ?",
                USER_ID,
                TASTE_PERFUME);
        insertExposure(SECOND_CANDIDATE, Instant.now().minus(1, ChronoUnit.DAYS));

        mockMvc.perform(get(URL).header("Accept-Language", "en"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.recommendation.evidenceSource").value("FIT"))
                .andExpect(jsonPath("$.recommendation.evidenceKey").value("woody"))
                .andExpect(jsonPath("$.recommendation.reason").value(
                        "Its woody accord is close to the perfumes you rated highly."));
    }

    /** 후보 캐시에 계열 code 를 함께 저장하고, 저장된 후보를 다시 쓸 때도 그 code 가 나갑니다. */
    @Test
    void storesScentFamilyCodeInTheCandidateCache() throws Exception {
        mockMvc.perform(get(URL)).andExpect(status().isOk());

        assertThat(jdbcTemplate.queryForList(
                "SELECT evidence_key FROM personalized_recommendation_candidates "
                        + "WHERE user_id = ?",
                String.class,
                USER_ID)).isNotEmpty().containsOnly("WOODY");
        assertThat(recommendationRepository.findCachedCandidates(USER_ID))
                .extracting(PersonalizedRecommendationCandidate::evidenceKey)
                .containsOnly("WOODY");
    }

    /** code 없이 저장된 옛 캐시 행은 계열 이름으로 code 를 찾아 채웁니다. */
    @Test
    void resolvesScentFamilyCodeForCachedRowsWithoutKey() throws Exception {
        mockMvc.perform(get(URL)).andExpect(status().isOk());
        jdbcTemplate.update(
                "UPDATE personalized_recommendation_candidates SET evidence_key = NULL "
                        + "WHERE user_id = ?",
                USER_ID);

        assertThat(recommendationRepository.findCachedCandidates(USER_ID))
                .isNotEmpty()
                .allSatisfy(candidate -> {
                    assertThat(candidate.evidenceSource()).isEqualTo("TASTE");
                    assertThat(candidate.evidenceName()).isEqualTo("우디");
                    assertThat(candidate.evidenceKey()).isEqualTo("WOODY");
                    assertThat(candidate.originalName()).isNotBlank();
                });
    }

    @Test
    void preventsAnotherUserFromCompletingTheExposure() throws Exception {
        mockMvc.perform(get(URL)).andExpect(status().isOk());
        UUID token = jdbcTemplate.queryForObject(
                "SELECT recommendation_token FROM personalized_recommendation_offers "
                        + "WHERE user_id = ?",
                UUID.class,
                USER_ID);
        jdbcTemplate.update(
                "INSERT INTO users (user_id, email, password_hash, nickname) "
                        + "VALUES (?, ?, 'x', '다른사용자')",
                OTHER_USER_ID,
                "other-personalized@hyanghae.test");
        currentUser.id = OTHER_USER_ID;

        mockMvc.perform(post(URL + "/" + token + "/exposure"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code")
                        .value("RECOMMENDATION_EXPOSURE_NOT_FOUND"));

        assertThat(jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM personalized_recommendation_exposures "
                        + "WHERE recommendation_token = ?",
                Integer.class,
                token)).isZero();
    }

    @Test
    void issuesANewTokenForEveryRecommendationRequest() throws Exception {
        mockMvc.perform(get(URL)).andExpect(status().isOk());
        mockMvc.perform(get(URL)).andExpect(status().isOk());

        List<UUID> tokens = jdbcTemplate.queryForList(
                "SELECT recommendation_token FROM personalized_recommendation_offers "
                        + "WHERE user_id = ?",
                UUID.class,
                USER_ID);
        assertThat(tokens).hasSize(2).doesNotHaveDuplicates();
    }

    @Test
    void rejectsExpiredExposureToken() throws Exception {
        mockMvc.perform(get(URL)).andExpect(status().isOk());
        UUID token = jdbcTemplate.queryForObject(
                "SELECT recommendation_token FROM personalized_recommendation_offers "
                        + "WHERE user_id = ?",
                UUID.class,
                USER_ID);
        jdbcTemplate.update(
                "UPDATE personalized_recommendation_offers "
                        + "SET issued_at = NOW() - INTERVAL '2 hours', "
                        + "expires_at = NOW() - INTERVAL '1 hour' "
                        + "WHERE recommendation_token = ?",
                token);

        mockMvc.perform(post(URL + "/" + token + "/exposure"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code")
                        .value("RECOMMENDATION_EXPOSURE_NOT_FOUND"));
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
    void reusesValidCandidatesWithoutRunningTheHeavyCalculationAgain() throws Exception {
        mockMvc.perform(get(URL)).andExpect(status().isOk());
        deleteCandidateSignals();

        mockMvc.perform(get(URL))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.recommendation.perfumeId").isNumber());
    }

    @Test
    void keepsEmptyResultUntilARefreshConditionOccurs() throws Exception {
        deleteCandidateSignals();

        mockMvc.perform(get(URL))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("RECOMMENDATION_NOT_FOUND"));
        assertThat(jdbcTemplate.queryForObject(
                "SELECT result_status FROM personalized_recommendation_cache_states "
                        + "WHERE user_id = ?",
                String.class,
                USER_ID)).isEqualTo("EMPTY");

        Long regionId = jdbcTemplate.queryForObject(
                "SELECT scent_region_id FROM scent_regions WHERE code = 'WOODY'", Long.class);
        insertFamily(FIRST_CANDIDATE, regionId, 0.9);

        mockMvc.perform(get(URL))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("RECOMMENDATION_NOT_FOUND"));
    }

    @Test
    void refreshesAtTheTenthViewIncludingRepeatedPerfumeViews() throws Exception {
        mockMvc.perform(get(URL)).andExpect(status().isOk());
        deleteCandidateSignals();
        for (int index = 0; index < 9; index++) {
            insertView(TASTE_PERFUME);
        }

        mockMvc.perform(get(URL)).andExpect(status().isOk());
        insertView(TASTE_PERFUME);

        mockMvc.perform(get(URL))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("RECOMMENDATION_NOT_FOUND"));
    }

    @Test
    void refreshesAtTheTwentyFourHourBoundary() throws Exception {
        mockMvc.perform(get(URL)).andExpect(status().isOk());
        deleteCandidateSignals();
        jdbcTemplate.update(
                "UPDATE personalized_recommendation_cache_states "
                        + "SET calculated_at = NOW() - INTERVAL '24 hours' WHERE user_id = ?",
                USER_ID);

        mockMvc.perform(get(URL))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("RECOMMENDATION_NOT_FOUND"));
    }

    @Test
    void refreshesWhenEverySavedCandidateBecomesOwned() throws Exception {
        mockMvc.perform(get(URL)).andExpect(status().isOk());
        jdbcTemplate.update(
                "INSERT INTO user_perfumes "
                        + "(user_id, perfume_id, ownership_status, is_representative) "
                        + "VALUES (?, ?, 'OWNED', FALSE), (?, ?, 'OWNED', FALSE)",
                USER_ID, FIRST_CANDIDATE, USER_ID, SECOND_CANDIDATE);

        mockMvc.perform(get(URL))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("RECOMMENDATION_NOT_FOUND"));
    }

    @Test
    void refreshesAfterSourceVersionIsInvalidated() throws Exception {
        mockMvc.perform(get(URL)).andExpect(status().isOk());
        deleteCandidateSignals();
        recommendationRepository.incrementSourceVersion(USER_ID);

        mockMvc.perform(get(URL))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("RECOMMENDATION_NOT_FOUND"));
    }

    @Test
    void failsImmediatelyWhenAnotherRequestIsRefreshingTheSameUser() throws Exception {
        CountDownLatch locked = new CountDownLatch(1);
        CountDownLatch release = new CountDownLatch(1);
        try (var executor = Executors.newSingleThreadExecutor()) {
            var lockHolder = executor.submit(() ->
                    new TransactionTemplate(transactionManager).executeWithoutResult(status -> {
                        jdbcTemplate.query(
                                "SELECT pg_advisory_xact_lock(?)",
                                resultSet -> null,
                                USER_ID);
                        locked.countDown();
                        try {
                            if (!release.await(5, TimeUnit.SECONDS)) {
                                throw new IllegalStateException("test lock release timed out");
                            }
                        } catch (InterruptedException exception) {
                            Thread.currentThread().interrupt();
                            throw new IllegalStateException(exception);
                        }
                    }));
            assertThat(locked.await(5, TimeUnit.SECONDS)).isTrue();

            try {
                mockMvc.perform(get(URL))
                        .andExpect(status().isConflict())
                        .andExpect(jsonPath("$.code")
                                .value("RECOMMENDATION_REFRESH_IN_PROGRESS"))
                        .andExpect(jsonPath("$.message").value("추천을 계산하고 있습니다."));
            } finally {
                release.countDown();
            }
            lockHolder.get(5, TimeUnit.SECONDS);
        }
    }

    @Test
    void keepsSourceChangeThatOccursDuringCalculationDirty() {
        long versionAtCalculationStart =
                recommendationRepository.ensureCacheStateAndGetSourceVersion(USER_ID);
        recommendationRepository.incrementSourceVersion(USER_ID);

        recommendationRepository.replaceCache(
                USER_ID,
                List.of(),
                versionAtCalculationStart,
                0,
                java.time.OffsetDateTime.now());

        var state = recommendationRepository.findCacheState(USER_ID).orElseThrow();
        assertThat(state.sourceVersion()).isNotEqualTo(state.calculatedSourceVersion());
    }

    @Test
    void keepsViewsCreatedDuringCalculationAfterTheSavedCheckpoint() {
        recommendationRepository.ensureCacheStateAndGetSourceVersion(USER_ID);
        long viewIdAtCalculationStart = recommendationRepository.findMaxViewId(USER_ID);
        for (int index = 0; index < 10; index++) {
            insertView(TASTE_PERFUME);
        }

        recommendationRepository.replaceCache(
                USER_ID,
                List.of(),
                0,
                viewIdAtCalculationStart,
                java.time.OffsetDateTime.now());

        assertThat(recommendationRepository.hasViewThresholdAfter(
                USER_ID,
                viewIdAtCalculationStart,
                10)).isTrue();
    }

    @Test
    void requiresLogin() throws Exception {
        currentUser.id = null;

        mockMvc.perform(get(URL))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("RECOMMENDATION_LOGIN_REQUIRED"));
    }

    @Test
    void requiresTasteTestEvenWhenFitRatingExists() throws Exception {
        jdbcTemplate.update(
                "UPDATE user_perfumes SET fit_rating = 5.0 "
                        + "WHERE user_id = ? AND perfume_id = ?",
                USER_ID,
                TASTE_PERFUME);
        jdbcTemplate.update("DELETE FROM user_taste_tests WHERE user_id = ?", USER_ID);

        mockMvc.perform(get(URL))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code")
                        .value("RECOMMENDATION_TASTE_TEST_REQUIRED"));
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

    private void insertView(long perfumeId) {
        jdbcTemplate.update(
                "INSERT INTO user_perfume_views (user_id, perfume_id, viewed_at) "
                        + "VALUES (?, ?, NOW())",
                USER_ID,
                perfumeId);
    }

    private void deleteCandidateSignals() {
        jdbcTemplate.update(
                "DELETE FROM perfume_scent_families WHERE perfume_id IN (?, ?)",
                FIRST_CANDIDATE,
                SECOND_CANDIDATE);
        jdbcTemplate.update(
                "DELETE FROM perfume_accords WHERE perfume_id IN (?, ?)",
                FIRST_CANDIDATE,
                SECOND_CANDIDATE);
    }

    private void clearData() {
        jdbcTemplate.update(
                "DELETE FROM personalized_recommendation_offers WHERE user_id IN (?, ?)",
                USER_ID, OTHER_USER_ID);
        jdbcTemplate.update(
                "DELETE FROM personalized_recommendation_exposures WHERE user_id IN (?, ?)",
                USER_ID, OTHER_USER_ID);
        jdbcTemplate.update(
                "DELETE FROM personalized_recommendation_cache_states WHERE user_id IN (?, ?)",
                USER_ID, OTHER_USER_ID);
        jdbcTemplate.update("DELETE FROM perfumes WHERE perfume_id >= 92100 AND perfume_id < 92112");
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
        jdbcTemplate.update("DELETE FROM accords WHERE accord_id = ?", ACCORD_ID + 1);
        jdbcTemplate.update("DELETE FROM users WHERE user_id = ?", USER_ID);
        jdbcTemplate.update("DELETE FROM users WHERE user_id = ?", OTHER_USER_ID);
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
