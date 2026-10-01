package com.hyanghae.backend.perfume.client;

import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Configuration;

/** 후기 요약 번역의 설정을 등록합니다. */
@Configuration(proxyBeanMethods = false)
@EnableConfigurationProperties(SummaryTranslationProperties.class)
class SummaryTranslationConfig {
}
