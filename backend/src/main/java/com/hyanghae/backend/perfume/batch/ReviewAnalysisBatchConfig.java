package com.hyanghae.backend.perfume.batch;

import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Configuration;

/**
 * 후기 요약 배치의 설정을 등록합니다.
 *
 * <p>{@link ReviewAnalysisProperties} 는 배치가 꺼져 있어도 등록합니다. 배치를 켜지 않아도
 * 분석기와 배치 서비스 빈은 만들어지고, 그 빈들이 설정을 주입받습니다.
 *
 * <p>{@code @EnableScheduling} 은 {@code BackendApplication} 으로 옮겼습니다. 자연어 추천의
 * 보관 기간 배치가 생겨 스케줄 작업이 둘이 됐습니다.
 */
@Configuration(proxyBeanMethods = false)
@EnableConfigurationProperties(ReviewAnalysisProperties.class)
class ReviewAnalysisBatchConfig {
}
