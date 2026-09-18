package com.hyanghae.backend.recommendation.client;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.boot.context.properties.bind.validation.BindValidationException;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;
import org.springframework.context.annotation.Configuration;

/**
 * {@code topK} 의 상한을 고정합니다.
 *
 * <p>이 값은 혼자 정해지지 않습니다. {@code nlr_recommendation_items} 의
 * {@code ck_nlr_items_rank} 가 1~5 만 받으므로, 여기가 6 을 허용하면 여섯 번째 결과의
 * INSERT 가 CHECK 에 걸립니다. 기록은 한 트랜잭션이라 그 요청의 기록이 통째로 사라지고,
 * 기록 실패는 추천을 막지 않으므로 <b>화면은 멀쩡한데 집계만 조용히 빕니다.</b>
 * 설정 한 줄로 그 상태에 들어가지 않도록 뜨는 순간 막습니다.
 */
class RecommendationPropertiesTest {

    private final ApplicationContextRunner runner = new ApplicationContextRunner()
            .withUserConfiguration(TestConfig.class);

    @Test
    @DisplayName("topK 가 5 면 뜬다")
    void bindsTopKAtUpperBound() {
        runner.withPropertyValues("hyanghae.recommendation.top-k=5")
                .run(context -> assertThat(context).hasNotFailed());
    }

    @Test
    @DisplayName("topK 가 6 이면 뜨지 않는다 — rank CHECK 이 5 까지라 기록이 사라진다")
    void rejectsTopKAboveRankCheck() {
        runner.withPropertyValues("hyanghae.recommendation.top-k=6")
                .run(context -> assertThat(context)
                        .getFailure()
                        .hasRootCauseInstanceOf(BindValidationException.class));
    }

    @Test
    @DisplayName("설정이 없으면 기본값 5 로 뜬다")
    void defaultsToFive() {
        runner.run(context -> assertThat(context.getBean(RecommendationProperties.class).topK())
                .isEqualTo(5));
    }

    @Configuration(proxyBeanMethods = false)
    @EnableConfigurationProperties(RecommendationProperties.class)
    static class TestConfig {
    }
}
