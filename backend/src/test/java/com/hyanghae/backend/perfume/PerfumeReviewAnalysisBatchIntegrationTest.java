package com.hyanghae.backend.perfume;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.atLeastOnce;
import static org.mockito.Mockito.verify;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.hyanghae.backend.perfume.repository.ReviewContent;
import com.hyanghae.backend.perfume.service.PerfumeReviewAnalysisBatchService;
import com.hyanghae.backend.perfume.service.ReviewAnalysisBatchResult;
import com.hyanghae.backend.perfume.service.ReviewAnalyzer;
import com.hyanghae.backend.support.IntegrationTest;
import java.time.OffsetDateTime;
import java.util.List;
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
 * 후기 요약 배치를 실제 PostgreSQL 위에서 검증합니다.
 *
 * <p>AI 호출만 대역으로 바꿉니다. 배치가 실제로 판단하는 것은 "어떤 향수를 고르는가", "어떤
 * 후기를 보내는가", "응답을 어떻게 다듬는가", "무엇을 적재하는가"이고, 그 판단은 모두 데이터베이스
 * 상태로 드러납니다. 외부 호출까지 실제로 하면 검증이 모델의 그날 응답에 좌우됩니다.
 *
 * <p>고정 데이터는 대상 선정의 갈림길을 하나씩 담고 있습니다.
 *
 * <ul>
 *   <li>향수 1: 본문 있는 후기 5건. 최소 개수를 채운 유일한 향수입니다.
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
        given(reviewAnalyzer.summarize(anyList())).willReturn(SUMMARY_TEXT);

        ReviewAnalysisBatchResult result = batchService.summarizePerfumesNeedingSummary();

        assertThat(result).isEqualTo(new ReviewAnalysisBatchResult(2, 1, 1, 0));
        assertThat(summaryTextOf(1)).isEqualTo(SUMMARY_TEXT);
        assertThat(sourceReviewCountOf(1)).isEqualTo(5);
        assertThat(summaryTextOf(2)).isNull();
        assertThat(summaryTextOf(3)).isNull();
        assertThat(summaryTextOf(4)).isNull();
    }

    /** 적재한 요약은 곧바로 조회 API 로 나갑니다. 적재 형식이 조회 쪽 전제와 같아야 합니다. */
    @Test
    void servesStoredSummaryThroughReadApi() throws Exception {
        given(reviewAnalyzer.summarize(anyList())).willReturn(SUMMARY_TEXT);

        batchService.summarizePerfumesNeedingSummary();

        mockMvc.perform(get(SUMMARY_URL, 1))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.summary").value(SUMMARY_TEXT))
                .andExpect(jsonPath("$.sourceReviewCount").value(5))
                .andExpect(jsonPath("$.updatedAt").isNotEmpty());
    }

    /**
     * 요약만 만들고 키워드는 건드리지 않습니다.
     *
     * <p>화면의 요약 구역이 문장을 그대로 보여주기로 정해져, 이 배치의 산출물은 요약 하나입니다.
     * 키워드 통계 구역은 채우는 코드가 없어 빈 배열입니다.
     */
    @Test
    void leavesKeywordTablesUntouched() throws Exception {
        given(reviewAnalyzer.summarize(anyList())).willReturn(SUMMARY_TEXT);

        batchService.summarizePerfumesNeedingSummary();

        assertThat(countRows("review_keywords")).isZero();
        assertThat(countRows("perfume_review_keywords")).isZero();
        mockMvc.perform(get(KEYWORDS_URL, 1))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.keywords").isEmpty());
    }

    /**
     * AI 에게 보내는 것은 후기 번호와 본문뿐입니다.
     *
     * <p>작성자를 보내지 않는 것은 개인정보 문제이고, 향수 이름을 보내지 않는 것은 요구사항
     * 때문입니다. 이름을 알려주면 모델이 학습으로 알고 있는 그 향수의 평판을 요약에 섞습니다.
     */
    @Test
    void sendsOnlyReviewIdAndText() {
        given(reviewAnalyzer.summarize(anyList())).willReturn(SUMMARY_TEXT);

        batchService.summarizePerfumesNeedingSummary();

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
        given(reviewAnalyzer.summarize(anyList())).willReturn(SUMMARY_TEXT);
        batchService.summarizePerfumesNeedingSummary();
        OffsetDateTime firstCreatedAt = createdAtOf(1);

        for (int i = 0; i < 9; i++) {
            insertReview(110 + i, 1, REVIEW_TEXT);
        }
        assertThat(batchService.summarizePerfumesNeedingSummary().summarized()).isZero();
        assertThat(sourceReviewCountOf(1)).isEqualTo(5);

        insertReview(120, 1, REVIEW_TEXT);
        given(reviewAnalyzer.summarize(anyList())).willReturn("다시 만든 요약입니다.");
        assertThat(batchService.summarizePerfumesNeedingSummary().summarized()).isEqualTo(1);

        assertThat(sourceReviewCountOf(1)).isEqualTo(15);
        assertThat(summaryTextOf(1)).isEqualTo("다시 만든 요약입니다.");
        assertThat(createdAtOf(1)).isEqualTo(firstCreatedAt);
    }

    /** 재생성할 때는 그 시점의 최근 후기를 다시 읽습니다. 요약은 향수 하나에 대한 글입니다. */
    @Test
    void sendsRecentReviewsAgainWhenRegenerating() {
        given(reviewAnalyzer.summarize(anyList())).willReturn(SUMMARY_TEXT);
        batchService.summarizePerfumesNeedingSummary();

        for (int i = 0; i < 10; i++) {
            insertReview(110 + i, 1, REVIEW_TEXT);
        }
        batchService.summarizePerfumesNeedingSummary();

        assertThat(lastCapturedReviews()).hasSize(15);
    }

    /**
     * 요약이 비어 있으면 아무것도 적재하지 않습니다.
     *
     * <p>빈 요약을 저장하면 {@code source_review_count} 가 올라가 다음 실행의 대상에서 빠지고,
     * 화면에는 계속 아무것도 나오지 않습니다.
     */
    @Test
    void skipsPerfumeWhenSummaryIsBlank() {
        given(reviewAnalyzer.summarize(anyList())).willReturn("   ");

        ReviewAnalysisBatchResult result = batchService.summarizePerfumesNeedingSummary();

        assertThat(result.summarized()).isZero();
        assertThat(result.skipped()).isEqualTo(2);
        assertThat(summaryTextOf(1)).isNull();
    }

    /**
     * 호출이 실패한 향수는 실패로 세고 실행은 계속합니다.
     *
     * <p>실패한 향수는 {@code source_review_count} 가 그대로여서 다음 실행에 다시 대상이 됩니다.
     */
    @Test
    void keepsGoingWhenSummarizeFails() {
        given(reviewAnalyzer.summarize(anyList()))
                .willThrow(new IllegalStateException("GMS 호출이 실패했습니다: status=429"));

        ReviewAnalysisBatchResult result = batchService.summarizePerfumesNeedingSummary();

        // 향수 1 은 호출이 실패하고, 향수 4 는 보낼 본문이 없어 호출 전에 건너뜁니다.
        assertThat(result).isEqualTo(new ReviewAnalysisBatchResult(2, 0, 1, 1));
        assertThat(summaryTextOf(1)).isNull();
    }

    /**
     * 한 번 실행에서 처리할 향수 수를 넘기지 않습니다. 기본값은 20입니다.
     *
     * <p>이 상한이 한 번의 AI 호출 비용을 정합니다. 남은 향수는 다음 실행이 이어서 집어 듭니다.
     */
    @Test
    void processesAtMostConfiguredNumberOfPerfumesPerRun() {
        for (int perfumeId = 500; perfumeId < 522; perfumeId++) {
            insertPerfume(perfumeId, "Scent " + perfumeId, true);
            for (int i = 0; i < 5; i++) {
                insertReview(perfumeId * 10L + i, perfumeId, REVIEW_TEXT);
            }
        }
        given(reviewAnalyzer.summarize(anyList())).willReturn(SUMMARY_TEXT);

        ReviewAnalysisBatchResult result = batchService.summarizePerfumesNeedingSummary();

        // 조건을 넘긴 향수는 24개(향수 1·4 와 새로 넣은 22개)입니다.
        assertThat(result.targets()).isEqualTo(20);
        assertThat(result.summarized() + result.skipped() + result.failed()).isEqualTo(20);
        assertThat(countRows("perfume_review_summaries")).isEqualTo(result.summarized());
    }

    /**
     * 설정을 켜지 않으면 스케줄러가 돌지 않습니다.
     *
     * <p>기본값이 꺼짐이라 로컬 실행과 테스트는 외부 API 를 호출하지 않습니다. 빈 이름으로
     * 확인하는 이유는 스케줄러 클래스가 다른 패키지에서 보이지 않기 때문입니다.
     */
    @Test
    void doesNotScheduleBatchByDefault() {
        assertThat(applicationContext.containsBean("reviewAnalysisScheduler")).isFalse();
    }

    /**
     * 실행 결과는 로그로 남기고 후기 원문과 요약 본문은 남기지 않습니다.
     *
     * <p>배치 로그는 Loki 에서 찾아 봐야 하므로 {@code key=value} 형태로 남깁니다. 반대로 후기와
     * 요약은 사용자가 쓴 글에서 나온 것이라 로그에 남기지 않습니다.
     */
    @Test
    void logsRunResultWithoutReviewText(CapturedOutput output) {
        given(reviewAnalyzer.summarize(anyList())).willReturn(SUMMARY_TEXT);

        batchService.summarizePerfumesNeedingSummary();

        assertThat(output).contains("Review summary batch completed:")
                .contains("targets=2", "summarized=1", "skipped=1", "failed=0");
        assertThat(output).doesNotContain(REVIEW_TEXT);
        assertThat(output).doesNotContain(SUMMARY_TEXT);
    }

    /** 분석기에 실제로 넘어간 후기입니다. 향수 4 는 보낼 본문이 없어 호출 자체가 한 번뿐입니다. */
    @SuppressWarnings("unchecked")
    private List<ReviewContent> capturedReviews() {
        ArgumentCaptor<List<ReviewContent>> captor = ArgumentCaptor.forClass(List.class);
        verify(reviewAnalyzer).summarize(captor.capture());
        return captor.getValue();
    }

    /** 마지막 호출에 넘어간 후기입니다. 실행을 두 번 하는 테스트가 씁니다. */
    @SuppressWarnings("unchecked")
    private List<ReviewContent> lastCapturedReviews() {
        ArgumentCaptor<List<ReviewContent>> captor = ArgumentCaptor.forClass(List.class);
        verify(reviewAnalyzer, atLeastOnce()).summarize(captor.capture());
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

    private int countRows(String table) {
        return jdbcTemplate.queryForObject("SELECT COUNT(*) FROM " + table, Integer.class);
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
