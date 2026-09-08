package com.hyanghae.backend.global.monitoring;

import org.springframework.boot.SpringBootConfiguration;
import org.springframework.boot.autoconfigure.EnableAutoConfiguration;

/**
 * {@link PrometheusMetricsIntegrationTest} 전용 최소 설정입니다. 컴포넌트 스캔을 하지 않습니다.
 *
 * <p>같은 패키지에서 {@code classes} 를 지정하지 않은 {@code @SpringBootTest} 를 쓰면
 * {@code BackendApplication} 대신 이 설정이 잡힐 수 있습니다. 그런 테스트를 추가할 때는
 * {@code classes} 를 명시하세요.
 */
@SpringBootConfiguration
@EnableAutoConfiguration
class MetricsTestApplication {
}
