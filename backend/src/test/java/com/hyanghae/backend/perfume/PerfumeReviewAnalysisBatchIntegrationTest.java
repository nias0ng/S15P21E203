package com.hyanghae.backend.perfume;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.atLeastOnce;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.hyanghae.backend.perfume.repository.ReviewContent;
import com.hyanghae.backend.perfume.service.PerfumeReviewAnalysisBatchService;
import com.hyanghae.backend.perfume.service.ReviewAnalysisBatchResult;
import com.hyanghae.backend.perfume.service.ReviewAnalyzer;
import com.hyanghae.backend.perfume.service.ReviewAnalyzer.ExtractedKeywords;
import com.hyanghae.backend.perfume.service.ReviewAnalyzer.ExtractionSource;
import com.hyanghae.backend.perfume.service.ReviewAnalyzer.ReviewKeywords;
import com.hyanghae.backend.support.IntegrationTest;
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
 * 후기 키워드 추출 배치를 실제 PostgreSQL 위에서 검증합니다.
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
 *   <li>향수 4: 후기 5건이지만 본문이 모두 비어 있습니다. 보낼 것이 없어 대상이 되지 않습니다.
 * </ul>
 */
@IntegrationTest
@AutoConfigureMockMvc
@ExtendWith(OutputCaptureExtension.class)
class PerfumeReviewAnalysisBatchIntegrationTest {

    private static final String KEYWORDS_URL = "/api/v1/perfumes/{perfumeId}/review-keywords";

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
     * 최소 후기 수를 채운 향수만 대상입니다.
     *
     * <p>본문이 비어 있는 향수 4 는 대상에서 빠집니다. 보낼 후기가 없는데 대상으로 잡으면 매 주기
     * 조회만 하고 아무것도 하지 않는 향수가 됩니다.
     */
    @Test
    void extractsKeywordsOnlyForPerfumesThatReachedMinimumReviewCount() {
        givenKeywords(new ReviewKeywords(100L, List.of("달콤한", "포근한")),
                new ReviewKeywords(101L, List.of("달콤한")));

        ReviewAnalysisBatchResult result = batchService.extractPendingKeywords();

        assertThat(result).isEqualTo(new ReviewAnalysisBatchResult(1, 1, 0, 0));
        assertThat(countLinks(100)).isEqualTo(2);
        assertThat(countLinks(101)).isEqualTo(1);
        assertThat(countLinksOfPerfume(2)).isZero();
        assertThat(countLinksOfPerfume(3)).isZero();
        assertThat(countLinksOfPerfume(4)).isZero();
    }

    /** 적재한 키워드는 곧바로 조회 API 로 나갑니다. 적재 형식이 조회 쪽 전제와 같아야 합니다. */
    @Test
    void servesStoredKeywordsThroughReadApi() throws Exception {
        givenKeywords(new ReviewKeywords(100L, List.of("달콤한", "포근한")),
                new ReviewKeywords(101L, List.of("달콤한")));

        batchService.extractPendingKeywords();

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
        givenKeywords(new ReviewKeywords(100L, List.of("달콤한", "포근한")),
                new ReviewKeywords(101L, List.of("달콤한")),
                new ReviewKeywords(102L, List.of("달콤한")));

        batchService.extractPendingKeywords();

        assertThat(countKeywordNames("달콤한")).isEqualTo(1);
        assertThat(countLinks(100)).isEqualTo(2);
        assertThat(countLinks(101)).isEqualTo(1);
        assertThat(countLinks(102)).isEqualTo(1);
    }

    /**
     * AI 에게 보내는 것은 후기 번호와 본문뿐입니다.
     *
     * <p>작성자를 보내지 않는 것은 개인정보 문제이고, 향수 이름을 보내지 않는 것은 모델이 학습으로
     * 알고 있는 그 향수의 평판을 섞지 않게 하기 위해서입니다.
     */
    @Test
    void sendsOnlyReviewIdAndText() {
        givenKeywords();

        batchService.extractPendingKeywords();

        List<ReviewContent> sent = capturedSource().reviews();
        assertThat(sent).hasSize(5);
        assertThat(sent).allSatisfy(review -> {
            assertThat(review.reviewId()).isNotNull();
            assertThat(review.content()).isEqualTo(REVIEW_TEXT);
        });
        assertThat(sent).extracting(ReviewContent::reviewId)
                .containsExactlyInAnyOrder(100L, 101L, 102L, 103L, 104L);
    }

    /**
     * 키워드가 하나도 나오지 않은 후기도 처리했다고 기록합니다.
     *
     * <p>이 기록이 없으면 향 표현이 없는 후기("선물로 받았어요")를 매 주기 다시 보냅니다. 키워드
     * 행이 생기지 않아 아직 뽑지 않은 후기와 구분되지 않기 때문입니다. 실측에서 후기 16건 중
     * 5건이 키워드 0개였습니다. 향수가 늘면 아무 결과 없는 호출이 매시간 쌓입니다.
     */
    @Test
    void marksReviewsAsExtractedEvenWhenNoKeywordFound() {
        givenKeywords();

        assertThat(batchService.extractPendingKeywords().analyzed()).isEqualTo(1);

        assertThat(countPendingReviews(1)).isZero();
        assertThat(countLinksOfPerfume(1)).isZero();
        // 두 번째 실행은 대상이 없습니다. 같은 후기를 다시 보내지 않습니다.
        assertThat(batchService.extractPendingKeywords())
                .isEqualTo(new ReviewAnalysisBatchResult(0, 0, 0, 0));
        verify(reviewAnalyzer, times(1)).extract(any(ExtractionSource.class));
    }

    /** 한 번 뽑은 후기는 다시 보내지 않습니다. 다시 뽑아도 대체로 같은 값이 나오고 호출 시간만 늡니다. */
    @Test
    void doesNotSendSameReviewTwice() {
        givenKeywords(new ReviewKeywords(100L, List.of("달콤한")));
        batchService.extractPendingKeywords();

        assertThat(batchService.extractPendingKeywords().targets()).isZero();
        verify(reviewAnalyzer, times(1)).extract(any(ExtractionSource.class));
    }

    /**
     * 후기가 새로 쌓이면 그 후기만 보냅니다.
     *
     * <p>요약을 만들지 않으므로 재생성 간격이 없습니다. 후기가 한 건만 늘어도 그 한 건은 다음
     * 주기에 처리됩니다. 요약이 있던 때는 열 건이 모여야 대상이 됐습니다.
     */
    @Test
    void sendsOnlyNewReviewsWhenMoreArrive() {
        givenKeywords(new ReviewKeywords(100L, List.of("달콤한")));
        batchService.extractPendingKeywords();

        insertReview(110, 1, REVIEW_TEXT);
        insertReview(111, 1, REVIEW_TEXT);
        givenKeywords(new ReviewKeywords(110L, List.of("시원한")));
        assertThat(batchService.extractPendingKeywords().analyzed()).isEqualTo(1);

        assertThat(lastCapturedSource().reviews())
                .extracting(ReviewContent::reviewId)
                .containsExactlyInAnyOrder(110L, 111L);
        assertThat(keywordNamesOf(110)).containsExactly("시원한");
    }

    /**
     * 이미 뽑은 후기의 키워드는 그대로 남습니다.
     *
     * <p>모델이 보내지 않은 후기의 키워드를 돌려줘도 적재하지 않습니다. 판단을 모델에게 맡기면
     * 실행마다 결과가 달라집니다.
     */
    @Test
    void keepsKeywordsOfAlreadyExtractedReview() {
        givenKeywords(new ReviewKeywords(100L, List.of("달콤한", "포근한")));
        batchService.extractPendingKeywords();

        insertReview(110, 1, REVIEW_TEXT);
        givenKeywords(new ReviewKeywords(100L, List.of("시원한")));
        batchService.extractPendingKeywords();

        assertThat(keywordNamesOf(100)).containsExactly("달콤한", "포근한");
        assertThat(countKeywordNames("시원한")).isZero();
    }

    /**
     * 이미 쓰인 키워드 이름을 분석기에 알려 줍니다.
     *
     * <p>후기 하나는 한 번만 분석하므로 이번 호출은 새 후기만 봅니다. 알려 주지 않으면 같은 표현에
     * 다른 이름이 붙어 같은 뜻이 두 키워드로 갈라지고, 상위 몇 개를 뽑을 때 순위가 왜곡됩니다.
     */
    @Test
    void tellsAnalyzerWhichKeywordNamesAreAlreadyUsed() {
        givenKeywords(new ReviewKeywords(100L, List.of("달콤한", "포근한")));
        batchService.extractPendingKeywords();

        insertReview(110, 1, REVIEW_TEXT);
        batchService.extractPendingKeywords();

        assertThat(lastCapturedSource().knownKeywords())
                .containsExactlyInAnyOrder("달콤한", "포근한");
    }

    /**
     * 보내지 않은 후기 번호는 버립니다.
     *
     * <p>모델이 번호를 만들어내는 일이 실제로 있습니다. 그대로 적재하면 다른 향수의 후기에
     * 키워드가 붙어 엉뚱한 향수의 통계가 바뀝니다.
     */
    @Test
    void ignoresKeywordsForReviewThatWasNotSent() {
        givenKeywords(new ReviewKeywords(100L, List.of("달콤한")),
                new ReviewKeywords(200L, List.of("시원한")),
                new ReviewKeywords(999L, List.of("낯선")));

        batchService.extractPendingKeywords();

        assertThat(keywordNamesOf(100)).containsExactly("달콤한");
        assertThat(countLinks(200)).isZero();
        assertThat(countLinks(999)).isZero();
        assertThat(countKeywordNames("시원한")).isZero();
    }

    /** 후기 하나의 키워드 수 제한과 이름 길이 제한을 적용합니다. 어휘 컬럼이 50자입니다. */
    @Test
    void dropsTooLongKeywordAndCapsKeywordCountPerReview() {
        String tooLong = "가".repeat(51);
        givenKeywords(new ReviewKeywords(100L, List.of(
                "달콤한", "포근한", "시원한", "산뜻한", "묵직한", "은은한", tooLong, " ", "달콤한")));

        batchService.extractPendingKeywords();

        assertThat(keywordNamesOf(100))
                .containsExactly("달콤한", "포근한", "시원한", "산뜻한", "묵직한");
        assertThat(countKeywordNames(tooLong)).isZero();
    }

    /**
     * 호출이 실패한 향수는 실패로 세고, 그 후기는 다음 실행에 다시 대상이 됩니다.
     *
     * <p>추출 시각을 적재와 같은 트랜잭션에서 남기므로, 실패하면 시각도 남지 않습니다.
     */
    @Test
    void keepsGoingWhenExtractionFails() {
        given(reviewAnalyzer.extract(any(ExtractionSource.class)))
                .willThrow(new IllegalStateException("GMS 호출이 실패했습니다: status=429"));

        ReviewAnalysisBatchResult result = batchService.extractPendingKeywords();

        assertThat(result).isEqualTo(new ReviewAnalysisBatchResult(1, 0, 0, 1));
        assertThat(countPendingReviews(1)).isEqualTo(5);
        assertThat(countLinksOfPerfume(1)).isZero();
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
        givenKeywords();

        ReviewAnalysisBatchResult result = batchService.extractPendingKeywords();

        // 조건을 넘긴 향수는 23개(향수 1 과 새로 넣은 22개)입니다.
        assertThat(result.targets()).isEqualTo(20);
        assertThat(result.analyzed()).isEqualTo(20);
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
     * 실행 결과는 로그로 남기고 후기 원문은 남기지 않습니다.
     *
     * <p>배치 로그는 Loki 에서 찾아 봐야 하므로 {@code key=value} 형태로 남깁니다. 반대로 후기는
     * 사용자가 쓴 글이라 로그에 남기지 않습니다.
     */
    @Test
    void logsRunResultWithoutReviewText(CapturedOutput output) {
        givenKeywords(new ReviewKeywords(100L, List.of("달콤한")));

        batchService.extractPendingKeywords();

        assertThat(output).contains("Review keyword batch completed:")
                .contains("targets=1", "analyzed=1", "skipped=0", "failed=0");
        assertThat(output).doesNotContain(REVIEW_TEXT);
    }

    private void givenKeywords(ReviewKeywords... reviewKeywords) {
        given(reviewAnalyzer.extract(any(ExtractionSource.class)))
                .willReturn(new ExtractedKeywords(List.of(reviewKeywords)));
    }

    /** 분석기에 실제로 넘어간 자료입니다. 대상 향수가 하나뿐인 고정 데이터에서 씁니다. */
    private ExtractionSource capturedSource() {
        ArgumentCaptor<ExtractionSource> captor = ArgumentCaptor.forClass(ExtractionSource.class);
        verify(reviewAnalyzer).extract(captor.capture());
        return captor.getValue();
    }

    /** 마지막 호출에 넘어간 자료입니다. 실행을 두 번 하는 테스트가 씁니다. */
    private ExtractionSource lastCapturedSource() {
        ArgumentCaptor<ExtractionSource> captor = ArgumentCaptor.forClass(ExtractionSource.class);
        verify(reviewAnalyzer, atLeastOnce()).extract(captor.capture());
        return captor.getValue();
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

    private int countLinksOfPerfume(long perfumeId) {
        return jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM perfume_review_keywords rk"
                        + " JOIN perfume_reviews r ON r.id = rk.review_id"
                        + " WHERE r.perfume_id = ?",
                Integer.class,
                perfumeId
        );
    }

    /** 아직 키워드를 뽑지 않은, 본문이 있는 후기 수입니다. 배치가 대상을 고르는 기준입니다. */
    private int countPendingReviews(long perfumeId) {
        return jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM perfume_reviews"
                        + " WHERE perfume_id = ? AND keywords_extracted_at IS NULL"
                        + " AND content IS NOT NULL AND length(trim(content)) > 0",
                Integer.class,
                perfumeId
        );
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
