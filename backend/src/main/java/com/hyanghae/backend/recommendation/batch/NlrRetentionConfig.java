package com.hyanghae.backend.recommendation.batch;

import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Configuration;

/**
 * 보관 기간 설정을 등록합니다.
 *
 * <p>스케줄러가 꺼져 있어도 등록합니다. {@link NlrRetentionService} 는 스케줄러와 별개로
 * 만들어지고(손으로 부를 수 있어야 합니다) 그 빈이 설정을 주입받습니다. 후기 요약 배치의
 * {@code ReviewAnalysisBatchConfig} 와 같은 이유입니다.
 */
@Configuration(proxyBeanMethods = false)
@EnableConfigurationProperties(NlrRetentionProperties.class)
class NlrRetentionConfig {
}
