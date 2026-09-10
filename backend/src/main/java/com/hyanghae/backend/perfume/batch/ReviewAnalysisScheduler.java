package com.hyanghae.backend.perfume.batch;

import com.hyanghae.backend.global.logging.RequestIdFilter;
import com.hyanghae.backend.perfume.service.PerfumeReviewAnalysisBatchService;
import java.time.ZoneId;
import java.util.TimeZone;
import java.util.UUID;
import org.slf4j.MDC;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.scheduling.annotation.SchedulingConfigurer;
import org.springframework.scheduling.config.ScheduledTaskRegistrar;
import org.springframework.scheduling.support.CronTrigger;
import org.springframework.stereotype.Component;

/**
 * 후기 요약·키워드 배치를 주기적으로 실행합니다.
 *
 * <p>{@code hyanghae.review-analysis.enabled} 가 참일 때만 빈이 만들어집니다. 기본값이 거짓이라
 * 로컬 실행과 테스트는 외부 API 를 호출하지 않습니다. 운영에서는 환경변수로 켭니다.
 *
 * <p>후기를 저장하는 순간 호출하지 않고 배치로 도는 이유가 있습니다. 요약 생성은 수십 초가
 * 걸리는데, 그것이 후기 작성 응답에 붙으면 사용자가 그만큼 기다립니다. 실패했을 때 후기 작성을
 * 되돌릴 수도 없습니다. 배치는 실패한 향수를 다음 주기에 다시 집어 듭니다.
 *
 * <p>실행이 겹칠 걱정은 없습니다. 스케줄러 스레드 풀이 하나라 앞 실행이 끝나야 다음 실행이
 * 시작됩니다. 그래서 한 번 실행에서 처리할 향수 수를 제한하는 것이 중요합니다.
 *
 * <p>{@code @Scheduled(cron = "${...}")} 를 쓰지 않고 {@link SchedulingConfigurer} 로 등록합니다.
 * 애노테이션의 자리표시자는 {@code Environment} 만 보므로 {@link ReviewAnalysisProperties} 의
 * 기본값을 읽지 못합니다. 그러면 기본값이 코드에 있는데도 프로필 yaml 마다 {@code cron} 을 다시
 * 적어야 하고, 한 곳을 빼먹으면 배치를 켠 그 프로필에서만 애플리케이션이 뜨지 않습니다.
 */
@Component
@ConditionalOnProperty(
        prefix = "hyanghae.review-analysis",
        name = "enabled",
        havingValue = "true"
)
class ReviewAnalysisScheduler implements SchedulingConfigurer {

    /** 배치 실행임을 로그에서 알아볼 수 있게 붙이는 접두사입니다. */
    private static final String RUN_ID_PREFIX = "batch-";

    private final PerfumeReviewAnalysisBatchService perfumeReviewAnalysisBatchService;
    private final ReviewAnalysisProperties properties;

    /**
     * 배치를 켰는데 GMS 키가 없으면 애플리케이션이 뜨지 않게 합니다.
     *
     * <p>그냥 두면 주기마다 조용히 401 을 받고 실패 로그만 쌓입니다. 설정을 잘못 넣은 것이니
     * 배포 시점에 알아야 합니다.
     */
    ReviewAnalysisScheduler(
            PerfumeReviewAnalysisBatchService perfumeReviewAnalysisBatchService,
            ReviewAnalysisProperties properties
    ) {
        if (properties.gms().apiKey().isBlank()) {
            throw new IllegalStateException(
                    "hyanghae.review-analysis.enabled 가 참이면 hyanghae.review-analysis.gms.api-key"
                            + " 가 있어야 합니다.");
        }
        this.perfumeReviewAnalysisBatchService = perfumeReviewAnalysisBatchService;
        this.properties = properties;
    }

    /**
     * 설정의 주기와 시간대로 실행을 등록합니다.
     *
     * <p>표현식이 잘못됐으면 여기서 예외가 나 애플리케이션이 시작되지 않습니다. 잘못된 주기를
     * 조용히 무시해 배치가 영원히 돌지 않는 것보다 낫습니다.
     */
    @Override
    public void configureTasks(ScheduledTaskRegistrar registrar) {
        registrar.addTriggerTask(
                this::run,
                new CronTrigger(
                        properties.cron(),
                        TimeZone.getTimeZone(ZoneId.of(properties.zone()))
                )
        );
    }

    /**
     * 스케줄러 스레드에는 요청이 없으므로 실행마다 식별자를 직접 넣습니다.
     *
     * <p>{@link RequestIdFilter} 가 HTTP 요청에 하는 일과 같습니다. 이 값이 없으면 로그 패턴의
     * {@code requestId} 가 비어, 한 실행에서 나온 로그를 Loki 에서 묶어 볼 수 없습니다.
     */
    void run() {
        MDC.put(RequestIdFilter.MDC_KEY, RUN_ID_PREFIX + UUID.randomUUID());
        try {
            perfumeReviewAnalysisBatchService.analyzePerfumesNeedingSummary();
        } finally {
            MDC.remove(RequestIdFilter.MDC_KEY);
        }
    }
}
