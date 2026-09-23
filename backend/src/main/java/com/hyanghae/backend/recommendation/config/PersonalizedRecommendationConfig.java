package com.hyanghae.backend.recommendation.config;

import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Configuration;

@Configuration(proxyBeanMethods = false)
@EnableConfigurationProperties(PersonalizedRecommendationProperties.class)
public class PersonalizedRecommendationConfig {
}
