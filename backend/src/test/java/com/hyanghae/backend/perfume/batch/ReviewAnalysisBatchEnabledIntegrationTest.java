package com.hyanghae.backend.perfume.batch;

import static org.assertj.core.api.Assertions.assertThat;

import com.hyanghae.backend.support.IntegrationTest;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.ApplicationContext;
import org.springframework.scheduling.support.CronExpression;
import org.springframework.test.context.TestPropertySource;

/**
 * 배치를 켠 설정으로 애플리케이션이 뜨는지 검증합니다.
 *
 * <p>운영에서만 켜는 기능이라 평소 테스트는 꺼진 상태로 돕니다. 그래서 켰을 때만 드러나는 문제를
 * 아무 테스트도 잡지 못합니다. {@code cron} 표현식이 잘못됐거나 설정 자리표시자를 못 찾으면 빈을
 * 만드는 시점에 실패하는데, 그때는 이미 운영 배포가 시작된 뒤입니다.
 *
 * <p>테스트 데이터베이스는 비어 있어 실행 주기가 돌아와도 대상 향수가 없습니다. 그래서 이 테스트가
 * 실제 GMS 를 호출할 일은 없습니다.
 */
@IntegrationTest
@TestPropertySource(properties = {
        "hyanghae.review-analysis.enabled=true",
        "hyanghae.review-analysis.gms.api-key=test-key"
})
class ReviewAnalysisBatchEnabledIntegrationTest {

    @Autowired
    private ApplicationContext applicationContext;

    @Autowired
    private ReviewAnalysisProperties properties;

    /** 켜면 스케줄러 빈이 만들어집니다. 이 빈이 만들어지는 것 자체가 자리표시자 해석의 증거입니다. */
    @Test
    void registersSchedulerWhenEnabled() {
        assertThat(applicationContext.getBeansOfType(ReviewAnalysisScheduler.class)).hasSize(1);
    }

    /** 기본 실행 주기는 여섯 자리 표현식이어야 합니다. 다섯 자리로 적으면 실행되지 않습니다. */
    @Test
    void shipsValidCronExpression() {
        assertThat(CronExpression.isValidExpression(properties.cron())).isTrue();
    }
}
