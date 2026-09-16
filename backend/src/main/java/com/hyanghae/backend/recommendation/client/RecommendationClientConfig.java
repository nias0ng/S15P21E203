package com.hyanghae.backend.recommendation.client;

import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Configuration;

/** 자연어 추천의 설정을 등록합니다. */
@Configuration(proxyBeanMethods = false)
@EnableConfigurationProperties(RecommendationProperties.class)
class RecommendationClientConfig {
}
