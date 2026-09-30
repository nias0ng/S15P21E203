package com.hyanghae.backend.auth.config;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.time.Duration;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.bind.DefaultValue;
import org.springframework.validation.annotation.Validated;

/**
 * 회원가입 이메일 인증 설정입니다.
 *
 * <p>{@link AuthProperties} 에 넣지 않고 따로 둡니다. 그 record 는 여러 테스트가 생성자로 직접
 * 만들고 있어, 필드를 늘리면 인증과 상관없는 테스트까지 함께 고쳐야 합니다.
 */
@Validated
@ConfigurationProperties(prefix = "hyanghae.auth.email-verification")
public record EmailVerificationProperties(
        @DefaultValue("5m") @NotNull Duration codeTtl,
        @DefaultValue("60s") @NotNull Duration resendCooldown,
        @DefaultValue("5") @Min(1) int maxAttempts,
        @DefaultValue("5") @Min(1) int maxSendsPerHour,
        @DefaultValue("30m") @NotNull Duration verifiedTtl,
        @DefaultValue("no-reply@hyanghae.local") @NotBlank @Email String from
) {
}
