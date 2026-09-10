package com.hyanghae.backend.perfume.batch;

import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.EnableScheduling;

/**
 * 후기 요약·키워드 배치의 설정을 등록합니다.
 *
 * <p>{@link ReviewAnalysisProperties} 는 배치가 꺼져 있어도 등록합니다. 배치를 켜지 않아도
 * 분석기와 배치 서비스 빈은 만들어지고, 그 빈들이 설정을 주입받습니다.
 *
 * <p>{@code @EnableScheduling} 은 여기 있습니다. 지금 스케줄 작업이 이 배치 하나뿐이라 둘 곳이
 * 여기밖에 없습니다. 다른 도메인이 {@code @Scheduled} 를 추가하면 이 선언을 애플리케이션 공용
 * 설정으로 옮겨야 합니다.
 */
@Configuration(proxyBeanMethods = false)
@EnableScheduling
@EnableConfigurationProperties(ReviewAnalysisProperties.class)
class ReviewAnalysisBatchConfig {
}
