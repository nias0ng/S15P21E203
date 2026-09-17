package com.hyanghae.backend.global.storage;

import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Configuration;

/**
 * 이미지 저장소 설정을 등록합니다.
 *
 * <p>{@code @ConfigurationProperties} 만 붙이면 빈이 되지 않습니다. 등록하는 자리가 필요하고,
 * 도메인별 설정은 각 도메인의 {@code WebConfig} 가 등록하므로 공용 설정은 여기서 등록합니다.
 */
@Configuration(proxyBeanMethods = false)
@EnableConfigurationProperties(ImageStorageProperties.class)
class ImageStorageConfig {
}
