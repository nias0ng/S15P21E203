package com.hyanghae.backend.auth.controller;

import com.hyanghae.backend.auth.config.AuthProperties;
import com.hyanghae.backend.auth.service.IssuedRefreshToken;
import java.time.Duration;
import java.time.Instant;
import org.springframework.http.ResponseCookie;
import org.springframework.stereotype.Component;

@Component
public class RefreshTokenCookie {

    private static final String PATH = "/api/v1/auth";

    private final AuthProperties properties;

    public RefreshTokenCookie(AuthProperties properties) {
        this.properties = properties;
    }

    public ResponseCookie issue(IssuedRefreshToken token) {
        Duration remaining = Duration.between(Instant.now(), token.expiresAt());
        return base(token.value())
                .maxAge(remaining.isNegative() ? Duration.ZERO : remaining)
                .build();
    }

    public ResponseCookie expire() {
        return base("").maxAge(Duration.ZERO).build();
    }

    public String name() {
        return properties.cookie().name();
    }

    private ResponseCookie.ResponseCookieBuilder base(String value) {
        return ResponseCookie.from(properties.cookie().name(), value)
                .httpOnly(true)
                .secure(properties.cookie().secure())
                .sameSite(properties.cookie().sameSite())
                .path(PATH);
    }
}
