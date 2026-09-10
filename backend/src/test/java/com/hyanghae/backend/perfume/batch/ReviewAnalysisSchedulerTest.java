package com.hyanghae.backend.perfume.batch;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.mock;

import com.hyanghae.backend.global.logging.RequestIdFilter;
import com.hyanghae.backend.perfume.service.PerfumeReviewAnalysisBatchService;
import com.hyanghae.backend.perfume.service.ReviewAnalysisBatchResult;
import java.time.Duration;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.slf4j.MDC;

/**
 * 스케줄러가 실행 자체와 별개로 지는 두 가지 책임을 검증합니다. 설정 검사와 실행 식별자입니다.
 */
class ReviewAnalysisSchedulerTest {

    @AfterEach
    void clearMdc() {
        MDC.clear();
    }

    /**
     * 배치를 켰는데 GMS 키가 없으면 애플리케이션이 뜨지 않습니다.
     *
     * <p>그냥 두면 주기마다 조용히 401 을 받고 실패 로그만 쌓입니다. 설정을 잘못 넣은 것이므로
     * 배포 시점에 알아야 합니다.
     */
    @Test
    void failsToStartWhenApiKeyIsMissing() {
        PerfumeReviewAnalysisBatchService batchService =
                mock(PerfumeReviewAnalysisBatchService.class);

        assertThatThrownBy(() -> new ReviewAnalysisScheduler(batchService, properties("  ")))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("api-key");
    }

    /**
     * 실행마다 MDC 에 식별자를 넣습니다.
     *
     * <p>스케줄러 스레드에는 요청이 없어 {@code RequestIdFilter} 가 관여하지 않습니다. 이 값이
     * 없으면 로그 패턴의 {@code requestId} 가 비어, 한 실행에서 나온 로그를 묶어 볼 수 없습니다.
     */
    @Test
    void putsRunIdIntoMdcWhileRunningAndRemovesItAfterwards() {
        PerfumeReviewAnalysisBatchService batchService =
                mock(PerfumeReviewAnalysisBatchService.class);
        AtomicReference<String> requestIdDuringRun = new AtomicReference<>();
        given(batchService.extractPendingKeywords()).willAnswer(invocation -> {
            requestIdDuringRun.set(MDC.get(RequestIdFilter.MDC_KEY));
            return new ReviewAnalysisBatchResult(0, 0, 0, 0);
        });

        new ReviewAnalysisScheduler(batchService, properties("test-key")).run();

        assertThat(requestIdDuringRun.get()).startsWith("batch-");
        assertThat(MDC.get(RequestIdFilter.MDC_KEY)).isNull();
    }

    /** 실행이 예외로 끝나도 식별자를 지웁니다. 남으면 그 스레드의 다음 실행 로그에 묶입니다. */
    @Test
    void removesRunIdFromMdcWhenRunFails() {
        PerfumeReviewAnalysisBatchService batchService =
                mock(PerfumeReviewAnalysisBatchService.class);
        given(batchService.extractPendingKeywords())
                .willThrow(new IllegalStateException("조회에 실패했습니다."));

        ReviewAnalysisScheduler scheduler =
                new ReviewAnalysisScheduler(batchService, properties("test-key"));

        assertThatThrownBy(scheduler::run).isInstanceOf(IllegalStateException.class);
        assertThat(MDC.get(RequestIdFilter.MDC_KEY)).isNull();
    }

    private ReviewAnalysisProperties properties(String apiKey) {
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
                        apiKey,
                        "gpt-5-nano",
                        Duration.ofSeconds(10),
                        Duration.ofSeconds(60)
                )
        );
    }
}
