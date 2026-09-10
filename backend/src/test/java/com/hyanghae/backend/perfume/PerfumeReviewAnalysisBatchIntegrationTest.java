package com.hyanghae.backend.perfume;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.verify;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.hyanghae.backend.perfume.repository.ReviewContent;
import com.hyanghae.backend.perfume.service.PerfumeReviewAnalysisBatchService;
import com.hyanghae.backend.perfume.service.ReviewAnalysisBatchResult;
import com.hyanghae.backend.perfume.service.ReviewAnalyzer;
import com.hyanghae.backend.perfume.service.ReviewAnalyzer.ReviewAnalysis;
import com.hyanghae.backend.perfume.service.ReviewAnalyzer.ReviewKeywords;
import com.hyanghae.backend.support.IntegrationTest;
import java.time.OffsetDateTime;
import java.util.List;
import org.hamcrest.Matchers;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.system.CapturedOutput;
import org.springframework.boot.test.system.OutputCaptureExtension;
import org.springframework.context.ApplicationContext;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

/**
 * 후기 요약·키워드 배치를 실제 PostgreSQL 위에서 검증합니다.
 *
 * <p>AI 호출만 대역으로 바꿉니다. 배치가 실제로 판단하는 것은 "어떤 향수를 고르는가", "응답을
 * 어떻게 다듬는가", "무엇을 적재하는가"이고, 그 판단은 모두 데이터베이스 상태로 드러납니다.
 * 외부 호출까지 실제로 하면 검증이 모델의 그날 응답에 좌우됩니다.
 *
 * <p>고정 데이터는 대상 선정의 갈림길을 하나씩 담고 있습니다.
 *
 * <ul>
 *   <li>향수 1: 후기 5건. 최소 개수를 채운 유일한 향수입니다.
 *   <li>향수 2: 후기 4건. 최소 개수에 하나 모자랍니다.
 *   <li>향수 3: 후기 6건이지만 비활성입니다. 조회 API 가 404 를 주는 향수입니다.
 *   <li>향수 4: 후기 5건이지만 본문이 모두 비어 있습니다. 대상은 되지만 보낼 것이 없습니다.
 * </ul>
 */
@IntegrationTest
@AutoConfigureMockMvc
@ExtendWith(OutputCaptureExtension.class)
class PerfumeReviewAnalysisBatchIntegrationTest {

    private static final String SUMMARY_URL = "/api/v1/perfumes/{perfumeId}/review-summary";
    private static final String KEYWORDS_URL = "/api/v1/perfumes/{perfumeId}/review-keywords";

    private static final String SUMMARY_TEXT = "달콤한 잔향이 오래 남는다는 평가가 많습니다.";
    private static final String REVIEW_TEXT = "처음에는 달콤하고 시간이 지나면 포근하게 남습니다.";

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Autowired
    private PerfumeReviewAnalysisBatchService batchService;

    @Autowired
    private ApplicationContext applicationContext;

    @MockitoBean
    private ReviewAnalyzer reviewAnalyzer;

    @BeforeEach
    void insertFixtures() {
        clearData();

        insertBrand(1, "Chanel");
        insertPerfume(1, "Base Scent", true);
        insertPerfume(2, "Few Reviews Scent", true);
        insertPerfume(3, "Retired Scent", false);
        insertPerfume(4, "Blank Review Scent", true);

        for (int i = 0; i < 5; i++) {
            insertReview(100 + i, 1, REVIEW_TEXT);
        }
        for (int i = 0; i < 4; i++) {
            insertReview(200 + i, 2, REVIEW_TEXT);
        }
        for (int i = 0; i < 6; i++) {
            insertReview(300 + i, 3, REVIEW_TEXT);
        }
        insertReview(400, 4, null);
        insertReview(401, 4, "");
        insertReview(402, 4, "   ");
        insertReview(403, 4, null);
        insertReview(404, 4, null);
    }

    @AfterEach
    void cleanUp() {
        clearData();
    }

    /**
     * 최소 후기 수를 채운 향수만 요약이 생깁니다.
     *
     * <p>본문이 비어 있는 향수 4 도 대상으로는 잡힙니다. 대상 선정은 후기 수만 보기 때문입니다.
     * 보낼 본문이 없다는 것은 후기를 읽어 본 뒤에 알 수 있고, 그때는 적재하지 않고 건너뜁니다.
     */
    @Test
    void summarizesOnlyPerfumesThatReachedMinimumReviewCount() {
        givenAnalysis(new ReviewAnalysis(SUMMARY_TEXT, List.of(
                new ReviewKeywords(100L, List.of("달콤한", "포근한")),
                new ReviewKeywords(101L, List.of("달콤한"))
        )));

        ReviewAnalysisBatchResult result = batchService.analyzePerfumesNeedingSummary();

        assertThat(result).isEqualTo(new ReviewAnalysisBatchResult(2, 1, 1, 0));
        assertThat(summaryTextOf(1)).isEqualTo(SUMMARY_TEXT);
        assertThat(sourceReviewCountOf(1)).isEqualTo(5);
        assertThat(summaryTextOf(2)).isNull();
        assertThat(summaryTextOf(3)).isNull();
        assertThat(summaryTextOf(4)).isNull();
    }

    /** 적재한 요약과 키워드는 곧바로 조회 API 로 나갑니다. 적재 형식이 조회 쪽 전제와 같아야 합니다. */
    @Test
    void servesStoredSummaryAndKeywordsThroughReadApi() throws Exception {
        givenAnalysis(new ReviewAnalysis(SUMMARY_TEXT, List.of(
                new ReviewKeywords(100L, List.of("달콤한", "포근한")),
                new ReviewKeywords(101L, List.of("달콤한"))
        )));

        batchService.analyzePerfumesNeedingSummary();

        mockMvc.perform(get(SUMMARY_URL, 1))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.summary").value(SUMMARY_TEXT))
                .andExpect(jsonPath("$.sourceReviewCount").value(5))
                .andExpect(jsonPath("$.updatedAt").isNotEmpty());

        // 분모는 키워드가 뽑힌 후기 수(2)입니다. "달콤한"은 두 건 모두, "포근한"은 한 건입니다.
        mockMvc.perform(get(KEYWORDS_URL, 1))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.keywords", Matchers.hasSize(2)))
                .andExpect(jsonPath("$.keywords[0].keyword").value("달콤한"))
                .andExpect(jsonPath("$.keywords[0].percentage").value(100.0))
                .andExpect(jsonPath("$.keywords[1].keyword").value("포근한"))
                .andExpect(jsonPath("$.keywords[1].percentage").value(50.0));
    }

    /** 같은 이름은 어휘를 새로 만들지 않고 같은 행을 씁니다. 유니크 제약이 이것을 강제합니다. */
    @Test
    void reusesKeywordVocabularyForSameName() {
        givenAnalysis(new ReviewAnalysis(SUMMARY_TEXT, List.of(
                new ReviewKeywords(100L, List.of("달콤한", "포근한")),
                new ReviewKeywords(101L, List.of("달콤한")),
                new ReviewKeywords(102L, List.of("달콤한"))
        )));

        batchService.analyzePerfumesNeedingSummary();

        assertThat(countKeywordNames("달콤한")).isEqualTo(1);
        assertThat(countLinks(100)).isEqualTo(2);
        assertThat(countLinks(101)).isEqualTo(1);
        assertThat(countLinks(102)).isEqualTo(1);
    }

    /**
     * AI 에게 보내는 것은 후기 번호와 본문뿐입니다.
     *
     * <p>작성자를 보내지 않는 것은 개인정보 문제이고, 향수 이름을 보내지 않는 것은 요구사항
     * 때문입니다. 이름을 알려주면 모델이 학습으로 알고 있는 그 향수의 평판을 요약에 섞습니다.
     */
    @Test
    void sendsOnlyReviewIdAndText() {
        givenAnalysis(new ReviewAnalysis(SUMMARY_TEXT, List.of()));

        batchService.analyzePerfumesNeedingSummary();

        List<ReviewContent> sent = capturedReviews();
        assertThat(sent).hasSize(5);
        assertThat(sent).allSatisfy(review -> {
            assertThat(review.reviewId()).isNotNull();
            assertThat(review.content()).isEqualTo(REVIEW_TEXT);
        });
        assertThat(sent).extracting(ReviewContent::reviewId)
                .containsExactlyInAnyOrder(100L, 101L, 102L, 103L, 104L);
    }

    /**
     * 요약 이후 후기가 정책 개수만큼 늘어나기 전에는 다시 만들지 않습니다.
     *
     * <p>기본 정책은 10개입니다. 9개까지는 대상이 아니고, 10번째가 들어오는 순간 대상이 됩니다.
     * 이 경계가 무너지면 후기가 한 건 늘 때마다 AI 호출이 나갑니다.
     */
    @Test
    void regeneratesOnlyAfterConfiguredNumberOfNewReviews() {
        givenAnalysis(new ReviewAnalysis(SUMMARY_TEXT, List.of()));
        batchService.analyzePerfumesNeedingSummary();
        OffsetDateTime firstCreatedAt = createdAtOf(1);

        for (int i = 0; i < 9; i++) {
            insertReview(110 + i, 1, REVIEW_TEXT);
        }
        assertThat(batchService.analyzePerfumesNeedingSummary().analyzed()).isZero();
        assertThat(sourceReviewCountOf(1)).isEqualTo(5);

        insertReview(120, 1, REVIEW_TEXT);
        givenAnalysis(new ReviewAnalysis("다시 만든 요약입니다.", List.of()));
        assertThat(batchService.analyzePerfumesNeedingSummary().analyzed()).isEqualTo(1);

        assertThat(sourceReviewCountOf(1)).isEqualTo(15);
        assertThat(summaryTextOf(1)).isEqualTo("다시 만든 요약입니다.");
        assertThat(createdAtOf(1)).isEqualTo(firstCreatedAt);
    }

    /**
     * 같은 후기를 다시 분석하면 키워드가 마지막 결과로 바뀝니다.
     *
     * <p>더하기만 하면 실행마다 조금씩 다른 AI 응답이 쌓여 키워드별 비중이 실제보다 커집니다.
     */
    @Test
    void replacesKeywordsOfReanalyzedReview() {
        givenAnalysis(new ReviewAnalysis(SUMMARY_TEXT, List.of(
                new ReviewKeywords(100L, List.of("달콤한", "포근한"))
        )));
        batchService.analyzePerfumesNeedingSummary();

        for (int i = 0; i < 10; i++) {
            insertReview(110 + i, 1, REVIEW_TEXT);
        }
        givenAnalysis(new ReviewAnalysis(SUMMARY_TEXT, List.of(
                new ReviewKeywords(100L, List.of("시원한"))
        )));
        batchService.analyzePerfumesNeedingSummary();

        assertThat(keywordNamesOf(100)).containsExactly("시원한");
    }

    /**
     * 보내지 않은 후기 번호는 버립니다.
     *
     * <p>모델이 번호를 만들어내는 일이 실제로 있습니다. 그대로 적재하면 다른 향수의 후기에
     * 키워드가 붙어 엉뚱한 향수의 통계가 바뀝니다.
     */
    @Test
    void ignoresKeywordsForReviewThatWasNotSent() {
        givenAnalysis(new ReviewAnalysis(SUMMARY_TEXT, List.of(
                new ReviewKeywords(100L, List.of("달콤한")),
                new ReviewKeywords(200L, List.of("시원한")),
                new ReviewKeywords(999L, List.of("낯선"))
        )));

        batchService.analyzePerfumesNeedingSummary();

        assertThat(keywordNamesOf(100)).containsExactly("달콤한");
        assertThat(countLinks(200)).isZero();
        assertThat(countLinks(999)).isZero();
        assertThat(countKeywordNames("시원한")).isZero();
    }

    /** 후기 하나의 키워드 수 제한과 이름 길이 제한을 적용합니다. 어휘 컬럼이 50자입니다. */
    @Test
    void dropsTooLongKeywordAndCapsKeywordCountPerReview() {
        String tooLong = "가".repeat(51);
        givenAnalysis(new ReviewAnalysis(SUMMARY_TEXT, List.of(
                new ReviewKeywords(100L, List.of(
                        "달콤한", "포근한", "시원한", "산뜻한", "묵직한", "은은한", tooLong, " ", "달콤한"))
        )));

        batchService.analyzePerfumesNeedingSummary();

        assertThat(keywordNamesOf(100))
                .containsExactly("달콤한", "포근한", "시원한", "산뜻한", "묵직한");
        assertThat(countKeywordNames(tooLong)).isZero();
    }

    /**
     * 요약이 비어 있으면 아무것도 적재하지 않습니다.
     *
     * <p>빈 요약을 저장하면 {@code source_review_count} 가 올라가 다음 실행의 대상에서 빠지고,
     * 화면에는 계속 아무것도 나오지 않습니다.
     */
    @Test
    void skipsPerfumeWhenSummaryIsBlank() {
        givenAnalysis(new ReviewAnalysis("   ", List.of(
                new ReviewKeywords(100L, List.of("달콤한"))
        )));

        ReviewAnalysisBatchResult result = batchService.analyzePerfumesNeedingSummary();

        assertThat(result.analyzed()).isZero();
        assertThat(result.skipped()).isEqualTo(2);
        assertThat(summaryTextOf(1)).isNull();
        assertThat(countLinks(100)).isZero();
    }

    /**
     * 호출이 실패한 향수는 실패로 세고 실행은 계속합니다.
     *
     * <p>AI 호출은 시간 초과나 사용량 제한으로 언제든 실패합니다. 한 건 때문에 실행 전체를
     * 멈추면 실패가 번집니다. 실패한 향수는 {@code source_review_count} 가 그대로여서 다음
     * 실행에 다시 대상이 됩니다.
     */
    @Test
    void keepsGoingWhenAnalysisFails() {
        given(reviewAnalyzer.analyze(anyList()))
                .willThrow(new IllegalStateException("GMS 호출이 실패했습니다: status=429"));

        ReviewAnalysisBatchResult result = batchService.analyzePerfumesNeedingSummary();

        // 향수 1 은 호출이 실패하고, 향수 4 는 보낼 본문이 없어 호출 전에 건너뜁니다.
        assertThat(result).isEqualTo(new ReviewAnalysisBatchResult(2, 0, 1, 1));
        assertThat(summaryTextOf(1)).isNull();
    }

    /**
     * 한 번 실행에서 처리할 향수 수를 넘기지 않습니다. 기본값은 20입니다.
     *
     * <p>이 상한이 한 번의 AI 호출 비용을 정합니다. 후기가 한꺼번에 쌓이면 조건을 넘긴 향수가
     * 수백 개가 될 수 있는데, 상한이 없으면 그만큼의 호출이 한 실행에서 나갑니다. 남은 향수는
     * 다음 실행이 이어서 집어 듭니다.
     */
    @Test
    void processesAtMostConfiguredNumberOfPerfumesPerRun() {
        for (int perfumeId = 500; perfumeId < 522; perfumeId++) {
            insertPerfume(perfumeId, "Scent " + perfumeId, true);
            for (int i = 0; i < 5; i++) {
                insertReview(perfumeId * 10L + i, perfumeId, REVIEW_TEXT);
            }
        }
        givenAnalysis(new ReviewAnalysis(SUMMARY_TEXT, List.of()));

        ReviewAnalysisBatchResult result = batchService.analyzePerfumesNeedingSummary();

        // 조건을 넘긴 향수는 24개(향수 1·4 와 새로 넣은 22개)입니다.
        assertThat(result.targets()).isEqualTo(20);
        assertThat(result.analyzed() + result.skipped() + result.failed()).isEqualTo(20);
        assertThat(countSummaries()).isEqualTo(result.analyzed());
    }

    /**
     * 설정을 켜지 않으면 스케줄러가 돌지 않습니다.
     *
     * <p>기본값이 꺼짐이라 로컬 실행과 테스트는 외부 API 를 호출하지 않습니다. 빈 이름으로
     * 확인하는 이유는 스케줄러 클래스가 다른 패키지에서 보이지 않기 때문입니다. 켰을 때 빈이
     * 만들어지는지는 {@code ReviewAnalysisBatchEnabledIntegrationTest} 가 봅니다.
     */
    @Test
    void doesNotScheduleBatchByDefault() {
        assertThat(applicationContext.containsBean("reviewAnalysisScheduler")).isFalse();
    }

    /**
     * 실행 결과는 로그로 남기고 후기 원문과 요약 본문은 남기지 않습니다.
     *
     * <p>배치 로그는 Loki 에서 찾아 봐야 하므로 {@code key=value} 형태로 남깁니다. 반대로 후기와
     * 요약은 사용자가 쓴 글이라 로그에 남기지 않습니다.
     */
    @Test
    void logsRunResultWithoutReviewText(CapturedOutput output) {
        givenAnalysis(new ReviewAnalysis(SUMMARY_TEXT, List.of(
                new ReviewKeywords(100L, List.of("달콤한"))
        )));

        batchService.analyzePerfumesNeedingSummary();

        assertThat(output).contains("Review analysis batch completed:")
                .contains("targets=2", "analyzed=1", "skipped=1", "failed=0");
        assertThat(output).doesNotContain(REVIEW_TEXT);
        assertThat(output).doesNotContain(SUMMARY_TEXT);
    }

    private void givenAnalysis(ReviewAnalysis analysis) {
        given(reviewAnalyzer.analyze(anyList())).willReturn(analysis);
    }

    /** 분석기에 실제로 넘어간 후기입니다. 향수 4 는 보낼 본문이 없어 호출 자체가 한 번뿐입니다. */
    @SuppressWarnings("unchecked")
    private List<ReviewContent> capturedReviews() {
        ArgumentCaptor<List<ReviewContent>> captor = ArgumentCaptor.forClass(List.class);
        verify(reviewAnalyzer).analyze(captor.capture());
        return captor.getValue();
    }

    private String summaryTextOf(long perfumeId) {
        return jdbcTemplate.query(
                "SELECT summary_text FROM perfume_review_summaries WHERE perfume_id = ?",
                resultSet -> resultSet.next() ? resultSet.getString(1) : null,
                perfumeId
        );
    }

    private Integer sourceReviewCountOf(long perfumeId) {
        return jdbcTemplate.queryForObject(
                "SELECT source_review_count FROM perfume_review_summaries WHERE perfume_id = ?",
                Integer.class,
                perfumeId
        );
    }

    private OffsetDateTime createdAtOf(long perfumeId) {
        return jdbcTemplate.queryForObject(
                "SELECT created_at FROM perfume_review_summaries WHERE perfume_id = ?",
                OffsetDateTime.class,
                perfumeId
        );
    }

    private List<String> keywordNamesOf(long reviewId) {
        return jdbcTemplate.queryForList(
                "SELECT k.name FROM perfume_review_keywords rk"
                        + " JOIN review_keywords k ON k.keyword_id = rk.keyword_id"
                        + " WHERE rk.review_id = ?"
                        + " ORDER BY k.keyword_id",
                String.class,
                reviewId
        );
    }

    private int countLinks(long reviewId) {
        return jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM perfume_review_keywords WHERE review_id = ?",
                Integer.class,
                reviewId
        );
    }

    private int countSummaries() {
        return jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM perfume_review_summaries", Integer.class);
    }

    private int countKeywordNames(String name) {
        return jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM review_keywords WHERE name = ?",
                Integer.class,
                name
        );
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

    private void insertReview(long id, long perfumeId, String content) {
        jdbcTemplate.update(
                "INSERT INTO perfume_reviews (id, perfume_id, content, created_at)"
                        + " VALUES (?, ?, ?, now())",
                id, perfumeId, content);
    }

    private void clearData() {
        jdbcTemplate.update("DELETE FROM perfume_review_keywords");
        jdbcTemplate.update("DELETE FROM review_keywords");
        jdbcTemplate.update("DELETE FROM perfume_review_summaries");
        jdbcTemplate.update("DELETE FROM perfume_reviews");
        jdbcTemplate.update("DELETE FROM perfumes");
        jdbcTemplate.update("DELETE FROM brands");
    }
}
