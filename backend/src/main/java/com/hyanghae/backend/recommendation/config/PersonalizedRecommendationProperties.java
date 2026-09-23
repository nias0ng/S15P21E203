package com.hyanghae.backend.recommendation.config;

import jakarta.validation.constraints.AssertTrue;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import java.time.Duration;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.bind.DefaultValue;
import org.springframework.validation.annotation.Validated;

/** 개인화 추천 후보의 갱신 주기와 발급 토큰 유효시간입니다. */
@Validated
@ConfigurationProperties(prefix = "hyanghae.recommendation.personalized")
public record PersonalizedRecommendationProperties(
        @DefaultValue("10") @Min(1) int viewRefreshThreshold,
        @DefaultValue("24h") @NotNull Duration maxAge,
        @DefaultValue("10m") @NotNull Duration offerTtl
) {

    @AssertTrue(message = "개인화 추천 시간 설정은 0보다 커야 합니다.")
    public boolean hasPositiveDurations() {
        return maxAge != null && !maxAge.isZero() && !maxAge.isNegative()
                && offerTtl != null && !offerTtl.isZero() && !offerTtl.isNegative();
    }
}
