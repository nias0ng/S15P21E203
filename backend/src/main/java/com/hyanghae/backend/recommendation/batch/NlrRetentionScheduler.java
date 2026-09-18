package com.hyanghae.backend.recommendation.batch;

import com.hyanghae.backend.global.logging.RequestIdFilter;
import java.time.ZoneId;
import java.util.TimeZone;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.slf4j.MDC;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.scheduling.annotation.SchedulingConfigurer;
import org.springframework.scheduling.config.ScheduledTaskRegistrar;
import org.springframework.scheduling.support.CronTrigger;
import org.springframework.stereotype.Component;

/**
 * 보관 기간 정리를 하루 한 번 돌립니다.
 *
 * <p>후기 요약 배치({@code ReviewAnalysisScheduler})와 같은 방식입니다.
 * {@code @Scheduled(cron = "${...}")} 를 쓰지 않고 {@link SchedulingConfigurer} 로 등록하는
 * 이유도 같습니다 — 애노테이션의 자리표시자는 {@code Environment} 만 보므로 설정 record 의
 * 기본값을 읽지 못하고, 그러면 프로필 yaml 마다 {@code cron} 을 다시 적어야 합니다.
 *
 * <p>{@code hyanghae.recommendation.retention.enabled} 가 거짓이면 빈이 만들어지지 않습니다.
 * <b>기본은 참입니다</b> — 끄면 정해 놓은 보관 기간이 지켜지지 않습니다.
 *
 * <p>실패해도 애플리케이션은 계속 돕니다. 다음 주기에 같은 줄을 다시 집어 듭니다 — 조건이
 * "보관 기간이 지났고 아직 안 비워진 줄" 이라 한 번 놓쳐도 사라지지 않습니다.
 */
@Component
@ConditionalOnProperty(
        prefix = "hyanghae.recommendation.retention",
        name = "enabled",
        havingValue = "true",
        matchIfMissing = true
)
class NlrRetentionScheduler implements SchedulingConfigurer {

    private static final Logger log = LoggerFactory.getLogger(NlrRetentionScheduler.class);

    /** 배치 실행임을 로그에서 알아볼 수 있게 붙이는 접두사입니다. */
    private static final String RUN_ID_PREFIX = "retention-";

    private final NlrRetentionService retentionService;
    private final NlrRetentionProperties properties;

    NlrRetentionScheduler(
            NlrRetentionService retentionService,
            NlrRetentionProperties properties
    ) {
        this.retentionService = retentionService;
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
     * 실행 한 번을 감쌉니다.
     *
     * <p>요청 번호를 붙여 로그에서 한 번의 실행을 묶어 볼 수 있게 합니다. HTTP 요청이 아니라
     * 스케줄 실행이라 {@link RequestIdFilter} 가 채워 주지 않습니다.
     *
     * <p><b>예외를 삼킵니다.</b> 스케줄 작업에서 예외가 올라가면 그 작업이 다시 등록되지 않아
     * 이후 주기가 영영 돌지 않습니다. 한 번 실패는 다음 주기에 만회되지만 멈춘 스케줄은 아무도
     * 모릅니다.
     */
    private void run() {
        MDC.put(RequestIdFilter.MDC_KEY, RUN_ID_PREFIX + UUID.randomUUID());
        try {
            retentionService.purge();
        } catch (RuntimeException exception) {
            log.error("자연어 추천 보관 기간 정리에 실패했습니다. 다음 주기에 다시 시도합니다.",
                    exception);
        } finally {
            MDC.clear();
        }
    }
}
