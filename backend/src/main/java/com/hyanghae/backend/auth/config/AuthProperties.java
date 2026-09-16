package com.hyanghae.backend.auth.config;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.time.Duration;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.bind.DefaultValue;
import org.springframework.validation.annotation.Validated;

@Validated
@ConfigurationProperties(prefix = "hyanghae.auth")
public record AuthProperties(
        @DefaultValue("30m") @NotNull Duration accessTokenTtl,
        @DefaultValue("7d") @NotNull Duration refreshTokenTtl,
        @DefaultValue("2") @Min(1) int maxSessionsPerUser,
        @DefaultValue("hyanghae") @NotBlank String issuer,
        @DefaultValue("") String jwtSecret,
        @DefaultValue("true") boolean enforceHttpAuthorization,
        @DefaultValue @Valid @NotNull Cookie cookie
) {

    public record Cookie(
            @DefaultValue("refresh_token") @NotBlank String name,
            @DefaultValue("true") boolean secure,
            @DefaultValue("Strict") @NotBlank String sameSite
    ) {
    }
}
