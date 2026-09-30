package com.hyanghae.backend.perfume;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.hyanghae.backend.perfume.repository.PerfumeReviewSummaryTranslationRepository;
import com.hyanghae.backend.perfume.service.SummaryTranslator;
import com.hyanghae.backend.support.IntegrationTest;
import java.sql.Timestamp;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.test.system.CapturedOutput;
import org.springframework.boot.test.system.OutputCaptureExtension;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Primary;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

/**
 * 영어 요청의 AI 후기 요약을 실제 PostgreSQL 위에서 검증합니다.
 *
 * <p>번역기는 정해진 답을 주는 대역입니다. 실제 GMS 는 부르지 않습니다. 대역이 몇 번 불렸는지를
 * 보는 이유는 "두 번째 요청은 저장본을 쓴다" 가 곧 "번역 비용이 한 번만 든다" 이기 때문입니다.
 */
@IntegrationTest
@AutoConfigureMockMvc
@ExtendWith(OutputCaptureExtension.class)
class PerfumeReviewSummaryTranslationIntegrationTest {

    private static final String SUMMARY_URL = "/api/v1/perfumes/{perfumeId}/review-summary";
    private static final String AGGREGATES_URL = "/api/v1/perfumes/{perfumeId}/review-aggregates";

    private static final long PERFUME = 1;
    private static final long NO_SUMMARY = 2;

    private static final String KOREAN_SUMMARY =
            "시트러스로 시작해 우디로 정착한다는 평입니다.\n· 지속력: 짧다는 의견이 있습니다.";
    private static final String UPDATED_AT = "2026-09-05T09:00:00Z";

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Autowired
    private FakeTranslator translator;

    @Autowired
    private PerfumeReviewSummaryTranslationRepository translationRepository;

    @Autowired
    private PlatformTransactionManager transactionManager;

    @BeforeEach
    void insertFixtures() {
        clearData();
        translator.reset();

        jdbcTemplate.update("INSERT INTO brands (brand_id, name, is_active) VALUES (1, 'Chanel', true)");
        insertPerfume(PERFUME, "Bleu de Chanel");
        insertPerfume(NO_SUMMARY, "No Summary Scent");
        jdbcTemplate.update(
                "INSERT INTO perfume_review_summaries (perfume_id, summary_text, source_review_count,"
                        + " created_at, updated_at) VALUES (?, ?, ?, ?, ?)",
                PERFUME, KOREAN_SUMMARY, 42,
                OffsetDateTime.parse(UPDATED_AT), OffsetDateTime.parse(UPDATED_AT));
    }

    @AfterEach
    void cleanUp() {
        clearData();
    }

    /** 한국어 요청은 지금과 똑같습니다. 번역기를 부르지 않고 번역도 저장하지 않습니다. */
    @Test
    void koreanRequestReturnsKoreanWithoutCallingTranslator() throws Exception {
        mockMvc.perform(get(SUMMARY_URL, PERFUME).header("Accept-Language", "ko"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.summary").value(KOREAN_SUMMARY))
                .andExpect(jsonPath("$.sourceReviewCount").value(42))
                .andExpect(jsonPath("$.updatedAt").value(UPDATED_AT));
        mockMvc.perform(get(SUMMARY_URL, PERFUME))
                .andExpect(jsonPath("$.summary").value(KOREAN_SUMMARY));

        assertThat(translator.calls).isEmpty();
        assertThat(translationCount()).isZero();
    }

    /** 영어 첫 요청이 한국어 요약을 옮겨 저장하고, 두 번째 요청은 저장본을 씁니다. */
    @Test
    void firstEnglishRequestTranslatesAndSecondUsesSavedTranslation() throws Exception {
        english(get(SUMMARY_URL, PERFUME))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.summary").value(FakeTranslator.english(KOREAN_SUMMARY)))
                .andExpect(jsonPath("$.sourceReviewCount").value(42))
                .andExpect(jsonPath("$.updatedAt").value(UPDATED_AT));

        assertThat(translator.calls).containsExactly(KOREAN_SUMMARY);
        Map<String, Object> saved = savedTranslation();
        assertThat(saved.get("summary_text")).isEqualTo(FakeTranslator.english(KOREAN_SUMMARY));
        assertThat(((Timestamp) saved.get("source_updated_at")).toInstant())
                .isEqualTo(Instant.parse(UPDATED_AT));

        english(get(SUMMARY_URL, PERFUME))
                .andExpect(jsonPath("$.summary").value(FakeTranslator.english(KOREAN_SUMMARY)));

        assertThat(translator.calls).hasSize(1);
    }

    /** 배치가 한국어 요약을 다시 만들면 갱신 시각이 달라져 다시 옮깁니다. */
    @Test
    void retranslatesWhenKoreanSummaryIsRegenerated() throws Exception {
        english(get(SUMMARY_URL, PERFUME)).andExpect(status().isOk());

        String regenerated = "플로럴로 바뀌었다는 평입니다.";
        String regeneratedAt = "2026-09-20T09:00:00Z";
        jdbcTemplate.update(
                "UPDATE perfume_review_summaries SET summary_text = ?, updated_at = ? WHERE perfume_id = ?",
                regenerated, OffsetDateTime.parse(regeneratedAt), PERFUME);

        english(get(SUMMARY_URL, PERFUME))
                .andExpect(jsonPath("$.summary").value(FakeTranslator.english(regenerated)))
                .andExpect(jsonPath("$.updatedAt").value(regeneratedAt));

        assertThat(translator.calls).containsExactly(KOREAN_SUMMARY, regenerated);
        assertThat(translationCount()).isEqualTo(1);
        assertThat(savedTranslation().get("summary_text")).isEqualTo(FakeTranslator.english(regenerated));
    }

    /** 번역이 실패하면 오류가 아니라 한국어 요약입니다. 실패한 번역은 저장하지 않습니다. */
    @Test
    void fallsBackToKoreanWhenTranslationFails() throws Exception {
        translator.failing = true;

        english(get(SUMMARY_URL, PERFUME))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.summary").value(KOREAN_SUMMARY))
                .andExpect(jsonPath("$.sourceReviewCount").value(42));

        assertThat(translationCount()).isZero();

        translator.failing = false;
        english(get(SUMMARY_URL, PERFUME))
                .andExpect(jsonPath("$.summary").value(FakeTranslator.english(KOREAN_SUMMARY)));
    }

    /** 한국어 요약이 바뀐 뒤 번역이 실패하면 낡은 영어판이 아니라 지금의 한국어 요약입니다. */
    @Test
    void doesNotServeStaleTranslationWhenRetranslationFails() throws Exception {
        english(get(SUMMARY_URL, PERFUME)).andExpect(status().isOk());

        String regenerated = "플로럴로 바뀌었다는 평입니다.";
        jdbcTemplate.update(
                "UPDATE perfume_review_summaries SET summary_text = ?, updated_at = ? WHERE perfume_id = ?",
                regenerated, OffsetDateTime.parse("2026-09-20T09:00:00Z"), PERFUME);
        translator.failing = true;

        english(get(SUMMARY_URL, PERFUME))
                .andExpect(jsonPath("$.summary").value(regenerated));
    }

    /** 번역 성공 · 실패 로그는 key=value 이고, 한국어 요약도 영어 번역도 남기지 않습니다. */
    @Test
    void logsTranslationWithoutSummaryText(CapturedOutput output) throws Exception {
        translator.failing = true;
        english(get(SUMMARY_URL, PERFUME)).andExpect(status().isOk());
        translator.failing = false;
        english(get(SUMMARY_URL, PERFUME)).andExpect(status().isOk());

        assertThat(output.getOut())
                .contains("Review summary translation failed: perfumeId=" + PERFUME + ", language=en")
                .contains("Review summary translated: perfumeId=" + PERFUME + ", language=en")
                .doesNotContain("시트러스")
                .doesNotContain("[en]");
    }

    /** 번역이 꺼져 있으면(접속 키 없음) 번역기를 부르지 않고 한국어 요약입니다. */
    @Test
    void fallsBackToKoreanWhenTranslatorIsDisabled() throws Exception {
        translator.enabled = false;

        english(get(SUMMARY_URL, PERFUME))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.summary").value(KOREAN_SUMMARY));

        assertThat(translator.calls).isEmpty();
        assertThat(translationCount()).isZero();
    }

    /** 요약이 없는 향수는 영어 요청이어도 필드가 모두 null 이고, 번역기를 부르지 않습니다. */
    @Test
    void englishRequestWithoutSummaryReturnsNullFields() throws Exception {
        english(get(SUMMARY_URL, NO_SUMMARY))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.summary").doesNotExist())
                .andExpect(jsonPath("$.sourceReviewCount").doesNotExist())
                .andExpect(jsonPath("$.updatedAt").doesNotExist());

        assertThat(translator.calls).isEmpty();
    }

    /** 후기 집계의 요약 조각도 같은 규칙입니다. 단건 조회가 저장한 번역을 함께 씁니다. */
    @Test
    void aggregatesUseSameTranslation() throws Exception {
        english(get(AGGREGATES_URL, PERFUME))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.reviewSummary.summary").value(FakeTranslator.english(KOREAN_SUMMARY)))
                .andExpect(jsonPath("$.reviewSummary.sourceReviewCount").value(42))
                .andExpect(jsonPath("$.reviewSummary.updatedAt").value(UPDATED_AT))
                .andExpect(jsonPath("$.reviewStatistics.reviewCount").value(0));

        english(get(SUMMARY_URL, PERFUME))
                .andExpect(jsonPath("$.summary").value(FakeTranslator.english(KOREAN_SUMMARY)));
        assertThat(translator.calls).hasSize(1);

        mockMvc.perform(get(AGGREGATES_URL, PERFUME).header("Accept-Language", "ko"))
                .andExpect(jsonPath("$.reviewSummary.summary").value(KOREAN_SUMMARY));
    }

    /**
     * 같은 요약을 두 번 저장해도 한 행이고, 옛 한국어 요약의 번역이 늦게 저장돼도 새 번역을 덮지 않습니다.
     *
     * <p>동시에 열린 두 영어 요청이 둘 다 번역해 저장하는 경우와, 한국어 요약이 바뀌는 사이에 옛
     * 요약을 옮기던 요청이 늦게 끝나는 경우입니다.
     */
    @Test
    void upsertKeepsOneRowAndNeverGoesBackToOlderSource() {
        Instant older = Instant.parse(UPDATED_AT);
        Instant newer = Instant.parse("2026-09-20T09:00:00Z");

        upsert("first", older);
        upsert("second", older);
        assertThat(translationCount()).isEqualTo(1);
        assertThat(savedTranslation().get("summary_text")).isEqualTo("second");

        upsert("newer", newer);
        upsert("late older", older);
        assertThat(savedTranslation().get("summary_text")).isEqualTo("newer");
    }

    private ResultActions english(MockHttpServletRequestBuilder request) throws Exception {
        return mockMvc.perform(request.header("Accept-Language", "en"));
    }

    private void upsert(String text, Instant sourceUpdatedAt) {
        new TransactionTemplate(transactionManager).executeWithoutResult(status ->
                translationRepository.upsert(PERFUME, "en", text, sourceUpdatedAt));
    }

    private void insertPerfume(long id, String name) {
        jdbcTemplate.update(
                "INSERT INTO perfumes (perfume_id, brand_id, name, is_active) VALUES (?, 1, ?, true)",
                id, name);
    }

    private Map<String, Object> savedTranslation() {
        return jdbcTemplate.queryForMap(
                "SELECT summary_text, source_updated_at FROM perfume_review_summary_translations"
                        + " WHERE perfume_id = ? AND language = 'en'", PERFUME);
    }

    private int translationCount() {
        Integer count = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM perfume_review_summary_translations", Integer.class);
        return count == null ? 0 : count;
    }

    private void clearData() {
        jdbcTemplate.update("DELETE FROM perfume_review_summary_translations");
        jdbcTemplate.update("DELETE FROM perfume_review_summaries");
        jdbcTemplate.update("DELETE FROM perfumes");
        jdbcTemplate.update("DELETE FROM brands");
    }

    @TestConfiguration
    static class Config {
        @Bean
        @Primary
        FakeTranslator fakeTranslator() {
            return new FakeTranslator();
        }
    }

    /** 받은 한국어 앞에 표시를 붙여 돌려주는 대역입니다. 받은 요약을 순서대로 적어 둡니다. */
    static class FakeTranslator implements SummaryTranslator {

        final List<String> calls = new ArrayList<>();
        volatile boolean enabled = true;
        volatile boolean failing = false;

        static String english(String korean) {
            return "[en] " + korean;
        }

        void reset() {
            calls.clear();
            enabled = true;
            failing = false;
        }

        @Override
        public boolean isEnabled() {
            return enabled;
        }

        @Override
        public synchronized String translateToEnglish(String koreanSummary) {
            calls.add(koreanSummary);
            if (failing) {
                throw new IllegalStateException("GMS 호출이 실패했습니다: status=503");
            }
            return english(koreanSummary);
        }
    }
}
