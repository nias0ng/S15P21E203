package com.hyanghae.backend.perfume.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;

import com.hyanghae.backend.perfume.batch.ReviewAnalysisProperties;
import com.hyanghae.backend.perfume.repository.KeywordExtractionTarget;
import com.hyanghae.backend.perfume.repository.PerfumeReviewKeywordRepository;
import com.hyanghae.backend.perfume.repository.PerfumeReviewRepository;
import com.hyanghae.backend.perfume.repository.ReviewContent;
import com.hyanghae.backend.perfume.service.ReviewAnalyzer.ExtractedKeywords;
import com.hyanghae.backend.perfume.service.ReviewAnalyzer.ExtractionSource;
import com.hyanghae.backend.perfume.service.ReviewAnalyzer.ReviewKeywords;
import java.time.Duration;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.data.domain.Pageable;

/**
 * AI 응답을 다듬는 규칙만 떼어 검증합니다.
 *
 * <p>데이터베이스 없이 봅니다. 이 규칙들은 순수한 판단이고, 통합 테스트로 확인하면 컨테이너를
 * 띄우는 시간이 규칙 하나마다 붙습니다. 적재된 결과가 실제로 데이터베이스에 어떻게 남는지는
 * {@code PerfumeReviewAnalysisBatchIntegrationTest} 가 봅니다.
 *
 * <p>모델의 출력은 규격을 자주 어깁니다. 보내지 않은 후기 번호, 어휘 컬럼보다 긴 이름, 빈
 * 문자열, 같은 후기가 두 번 오는 응답이 모두 실제로 나옵니다. 그것을 배치가 걸러내지 않으면
 * 엉뚱한 향수의 통계가 바뀌거나 적재 자체가 제약 위반으로 실패합니다.
 */
class PerfumeReviewAnalysisBatchServiceTest {

    private static final long PERFUME_ID = 1L;
    private static final String REVIEW_TEXT = "처음에는 달콤하고 시간이 지나면 포근하게 남습니다.";

    private final PerfumeReviewRepository perfumeReviewRepository =
            mock(PerfumeReviewRepository.class);
    private final PerfumeReviewKeywordRepository perfumeReviewKeywordRepository =
            mock(PerfumeReviewKeywordRepository.class);
    private final ReviewAnalyzer reviewAnalyzer = mock(ReviewAnalyzer.class);
    private final PerfumeReviewKeywordWriter writer = mock(PerfumeReviewKeywordWriter.class);

    private final PerfumeReviewAnalysisBatchService service =
            new PerfumeReviewAnalysisBatchService(
                    perfumeReviewRepository,
                    perfumeReviewKeywordRepository,
                    reviewAnalyzer,
                    writer,
                    properties()
            );

    @BeforeEach
    void givenOnePerfumeWithThreePendingReviews() {
        given(perfumeReviewRepository.findKeywordExtractionTargets(anyInt(), any(Pageable.class)))
                .willReturn(List.of(new KeywordExtractionTarget(PERFUME_ID, 5, 3)));
        given(perfumeReviewRepository.findContentsWithoutKeywords(
                any(Long.class), any(Pageable.class)))
                .willReturn(List.of(
                        new ReviewContent(11L, "제목", REVIEW_TEXT),
                        new ReviewContent(12L, "제목", REVIEW_TEXT),
                        new ReviewContent(13L, "제목", REVIEW_TEXT)
                ));
        given(perfumeReviewKeywordRepository.findKeywordCountsByPerfumeId(
                any(Long.class), any(Pageable.class)))
                .willReturn(List.of());
    }

    /** 보내지 않은 후기 번호는 버립니다. 다른 향수의 후기 번호면 엉뚱한 향수의 통계가 바뀝니다. */
    @Test
    void dropsKeywordsForReviewThatWasNotSent() {
        givenExtracted(new ReviewKeywords(11L, List.of("달콤한")),
                new ReviewKeywords(999L, List.of("낯선")));

        service.extractPendingKeywords();

        assertThat(written().keywordsByReviewId()).containsOnlyKeys(11L);
    }

    /** 후기 번호가 비어 있는 항목도 버립니다. */
    @Test
    void dropsKeywordsWithoutReviewId() {
        givenExtracted(new ReviewKeywords(null, List.of("달콤한")));

        service.extractPendingKeywords();

        assertThat(written().keywordsByReviewId()).isEmpty();
    }

    /**
     * 어휘 컬럼보다 긴 이름은 자르지 않고 버립니다.
     *
     * <p>자르면 중간에서 끊긴 이름이 어휘에 남고, 그 이름이 통계 화면에 그대로 나옵니다.
     */
    @Test
    void dropsKeywordLongerThanVocabularyColumn() {
        String tooLong = "가".repeat(51);
        givenExtracted(new ReviewKeywords(11L, List.of("달콤한", tooLong)));

        service.extractPendingKeywords();

        assertThat(written().keywordsByReviewId().get(11L)).containsExactly("달콤한");
    }

    /** 후기 하나의 키워드 수 제한을 넘기면 앞에서 자릅니다. */
    @Test
    void capsKeywordCountPerReview() {
        givenExtracted(new ReviewKeywords(11L, List.of(
                "달콤한", "포근한", "시원한", "산뜻한", "묵직한", "은은한", "깨끗한")));

        service.extractPendingKeywords();

        assertThat(written().keywordsByReviewId().get(11L))
                .containsExactly("달콤한", "포근한", "시원한", "산뜻한", "묵직한");
    }

    /** 빈 문자열과 중복은 정리합니다. 중복은 기본키 위반으로 적재를 실패시킵니다. */
    @Test
    void dropsBlankKeywordAndRemovesDuplicates() {
        givenExtracted(new ReviewKeywords(11L, List.of("달콤한", "", "   ", "달콤한")));

        service.extractPendingKeywords();

        assertThat(written().keywordsByReviewId().get(11L)).containsExactly("달콤한");
    }

    /**
     * 이름 안의 연속된 공백은 하나로 줄입니다.
     *
     * <p>줄이지 않으면 "달콤한 향"과 "달콤한  향"이 어휘에서 다른 행이 되어, 같은 뜻이 두
     * 키워드로 갈라집니다.
     */
    @Test
    void collapsesWhitespaceInsideKeyword() {
        givenExtracted(new ReviewKeywords(11L, List.of("  달콤한   향  ")));

        service.extractPendingKeywords();

        assertThat(written().keywordsByReviewId().get(11L)).containsExactly("달콤한 향");
    }

    /** 같은 후기 번호가 두 번 오면 앞의 것만 씁니다. 합치면 후기 하나의 개수 제한이 무너집니다. */
    @Test
    void keepsFirstEntryWhenSameReviewAppearsTwice() {
        givenExtracted(new ReviewKeywords(11L, List.of("달콤한")),
                new ReviewKeywords(11L, List.of("시원한")));

        service.extractPendingKeywords();

        assertThat(written().keywordsByReviewId().get(11L)).containsExactly("달콤한");
    }

    /**
     * 키워드가 하나도 없어도 보낸 후기 전체를 적재 대상에 담습니다.
     *
     * <p>이 목록으로 추출 시각을 남깁니다. 키워드가 나온 후기만 담으면 향 표현이 없는 후기가
     * 매 주기 다시 AI 에게 갑니다.
     */
    @Test
    void marksEverySentReviewEvenWhenNoKeywordFound() {
        givenExtracted();

        service.extractPendingKeywords();

        PerfumeReviewKeywords written = written();
        assertThat(written.extractedReviewIds()).containsExactly(11L, 12L, 13L);
        assertThat(written.keywordsByReviewId()).isEmpty();
    }

    /** 호출이 실패하면 적재하지 않습니다. 추출 시각도 남지 않아 다음 실행에 다시 대상이 됩니다. */
    @Test
    void doesNotWriteAnythingWhenExtractionFails() {
        given(reviewAnalyzer.extract(any(ExtractionSource.class)))
                .willThrow(new IllegalStateException("GMS 호출이 실패했습니다: status=429"));

        assertThat(service.extractPendingKeywords().failed()).isEqualTo(1);

        verify(writer, never()).write(any(PerfumeReviewKeywords.class));
    }

    /** 보낼 후기가 없으면 AI 를 부르지 않습니다. 대상 선정과 조회 사이에 처리된 경우입니다. */
    @Test
    void doesNotCallAnalyzerWhenNothingIsPending() {
        given(perfumeReviewRepository.findContentsWithoutKeywords(
                any(Long.class), any(Pageable.class)))
                .willReturn(List.of());

        assertThat(service.extractPendingKeywords())
                .isEqualTo(new ReviewAnalysisBatchResult(1, 0, 1, 0));

        verify(reviewAnalyzer, never()).extract(any(ExtractionSource.class));
        verify(writer, never()).write(any(PerfumeReviewKeywords.class));
    }

    private void givenExtracted(ReviewKeywords... reviewKeywords) {
        given(reviewAnalyzer.extract(any(ExtractionSource.class)))
                .willReturn(new ExtractedKeywords(List.of(reviewKeywords)));
    }

    private PerfumeReviewKeywords written() {
        ArgumentCaptor<PerfumeReviewKeywords> captor =
                ArgumentCaptor.forClass(PerfumeReviewKeywords.class);
        verify(writer).write(captor.capture());
        return captor.getValue();
    }

    /** 정규화 규칙이 보는 값만 실제 기본값과 같게 맞춥니다. */
    private ReviewAnalysisProperties properties() {
        return new ReviewAnalysisProperties(
                true,
                "0 10 * * * *",
                "Asia/Seoul",
                5,
                20,
                20,
                1000,
                50,
                5,
                new ReviewAnalysisProperties.Gms(
                        "https://gms.example.test/v1",
                        "test-key",
                        "gpt-5-nano",
                        Duration.ofSeconds(10),
                        Duration.ofSeconds(120)
                )
        );
    }
}
