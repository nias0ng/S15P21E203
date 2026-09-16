package com.hyanghae.backend.auth.service;

import java.time.Instant;

public record AuthSession(
        String sessionId,
        Long userId,
        String refreshTokenHash,
        Instant expiresAt
) {
}
