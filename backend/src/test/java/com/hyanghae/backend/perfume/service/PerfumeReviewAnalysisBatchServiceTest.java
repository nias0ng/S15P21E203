package com.hyanghae.backend.perfume.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;

import com.hyanghae.backend.perfume.batch.ReviewAnalysisProperties;
import com.hyanghae.backend.perfume.repository.PerfumeReviewRepository;
import com.hyanghae.backend.perfume.repository.ReviewContent;
import com.hyanghae.backend.perfume.repository.ReviewSummaryTarget;
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
 * <p>모델의 출력은 규격을 자주 어깁니다. 빈 요약, 앞뒤 공백, 길이 제한을 넘는 문장이 모두 실제로
 * 나옵니다. 그것을 배치가 걸러내지 않으면 화면에 빈 요약이 남거나 적재가 실패합니다.
 */
class PerfumeReviewAnalysisBatchServiceTest {

    private static final long PERFUME_ID = 1L;
    private static final String REVIEW_TEXT = "처음에는 달콤하고 시간이 지나면 포근하게 남습니다.";

    private final PerfumeReviewRepository perfumeReviewRepository =
            mock(PerfumeReviewRepository.class);
    private final ReviewAnalyzer reviewAnalyzer = mock(ReviewAnalyzer.class);
    private final PerfumeReviewSummaryWriter writer = mock(PerfumeReviewSummaryWriter.class);

    private final PerfumeReviewAnalysisBatchService service =
            new PerfumeReviewAnalysisBatchService(
                    perfumeReviewRepository,
                    reviewAnalyzer,
                    writer,
                    properties()
            );

    @BeforeEach
    void givenOnePerfumeWithSixReviews() {
        given(perfumeReviewRepository.findSummaryTargets(
                anyInt(), anyInt(), any(Pageable.class)))
                .willReturn(List.of(new ReviewSummaryTarget(PERFUME_ID, 6)));
        given(perfumeReviewRepository.findContentsByPerfumeId(anyLong(), any(Pageable.class)))
                .willReturn(List.of(
                        new ReviewContent(11L, "제목", REVIEW_TEXT),
                        new ReviewContent(12L, "제목", REVIEW_TEXT)
                ));
    }

    /** 앞뒤 공백은 지웁니다. 화면이 그대로 문장으로 보여주므로 공백이 남으면 줄바꿈이 어긋납니다. */
    @Test
    void trimsSummary() {
        given(reviewAnalyzer.summarize(anyList())).willReturn("  달콤한 향이라는 평이 많습니다.  ");

        service.summarizePerfumesNeedingSummary();

        assertThat(writtenSummary()).isEqualTo("달콤한 향이라는 평이 많습니다.");
    }

    /**
     * 빈 요약은 적재하지 않습니다.
     *
     * <p>빈 요약을 저장하면 {@code source_review_count} 가 올라가 다음 실행에서 재시도되지 않는데,
     * 화면에는 아무것도 나오지 않습니다.
     */
    @Test
    void doesNotWriteBlankSummary() {
        given(reviewAnalyzer.summarize(anyList())).willReturn("   ");

        assertThat(service.summarizePerfumesNeedingSummary())
                .isEqualTo(new ReviewAnalysisBatchResult(1, 0, 1, 0));

        verify(writer, never()).write(anyLong(), anyString(), anyInt());
    }

    /** 응답에 요약 필드가 없어 {@code null} 이 와도 적재하지 않습니다. */
    @Test
    void doesNotWriteNullSummary() {
        given(reviewAnalyzer.summarize(anyList())).willReturn(null);

        assertThat(service.summarizePerfumesNeedingSummary().skipped()).isEqualTo(1);

        verify(writer, never()).write(anyLong(), anyString(), anyInt());
    }

    /**
     * 길이 제한을 넘는 요약은 자릅니다.
     *
     * <p>실패로 처리하면 그 향수는 다음 실행에서 같은 응답을 받아 또 실패합니다. 길이는 프롬프트로도
     * 막고 있어 여기까지 오는 경우가 드뭅니다.
     */
    @Test
    void truncatesTooLongSummary() {
        given(reviewAnalyzer.summarize(anyList())).willReturn("가".repeat(1200));

        service.summarizePerfumesNeedingSummary();

        assertThat(writtenSummary()).hasSize(1000);
    }

    /**
     * 적재하는 기준 후기 수는 향수에 달린 전체 후기 수입니다.
     *
     * <p>AI 에게 보낸 후기 수(2건)가 아니라 대상 조회가 센 수(6건)입니다. 보낸 후기 수를 넣으면
     * 후기가 개수 제한을 넘긴 향수는 매 실행마다 재생성 대상이 됩니다.
     */
    @Test
    void writesTotalReviewCountNotSentCount() {
        given(reviewAnalyzer.summarize(anyList())).willReturn("달콤한 향이라는 평이 많습니다.");

        service.summarizePerfumesNeedingSummary();

        ArgumentCaptor<Integer> captor = ArgumentCaptor.forClass(Integer.class);
        verify(writer).write(anyLong(), anyString(), captor.capture());
        assertThat(captor.getValue()).isEqualTo(6);
    }

    /** 호출이 실패하면 적재하지 않습니다. 기준 후기 수가 그대로여서 다음 실행에 다시 대상이 됩니다. */
    @Test
    void doesNotWriteAnythingWhenSummarizeFails() {
        given(reviewAnalyzer.summarize(anyList()))
                .willThrow(new IllegalStateException("GMS 호출이 실패했습니다: status=429"));

        assertThat(service.summarizePerfumesNeedingSummary().failed()).isEqualTo(1);

        verify(writer, never()).write(anyLong(), anyString(), anyInt());
    }

    /** 보낼 후기 본문이 없으면 AI 를 부르지 않습니다. 본문이 빈 후기만 있는 향수입니다. */
    @Test
    void doesNotCallAnalyzerWhenNoReviewTextExists() {
        given(perfumeReviewRepository.findContentsByPerfumeId(anyLong(), any(Pageable.class)))
                .willReturn(List.of());

        assertThat(service.summarizePerfumesNeedingSummary())
                .isEqualTo(new ReviewAnalysisBatchResult(1, 0, 1, 0));

        verify(reviewAnalyzer, never()).summarize(anyList());
        verify(writer, never()).write(anyLong(), anyString(), anyInt());
    }

    private String writtenSummary() {
        ArgumentCaptor<String> captor = ArgumentCaptor.forClass(String.class);
        verify(writer).write(anyLong(), captor.capture(), anyInt());
        return captor.getValue();
    }

    /** 정규화 규칙이 보는 값만 실제 기본값과 같게 맞춥니다. */
    private ReviewAnalysisProperties properties() {
        return new ReviewAnalysisProperties(
                true,
                "0 10 * * * *",
                "Asia/Seoul",
                5,
                10,
                20,
                20,
                1000,
                1000,
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
