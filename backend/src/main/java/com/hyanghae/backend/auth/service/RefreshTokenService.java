package com.hyanghae.backend.auth.service;

import com.hyanghae.backend.auth.config.AuthProperties;
import com.hyanghae.backend.auth.exception.AuthErrorCode;
import com.hyanghae.backend.global.exception.BusinessException;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.Instant;
import java.util.Base64;
import java.util.UUID;
import org.springframework.stereotype.Service;

@Service
public class RefreshTokenService {

    private static final SecureRandom SECURE_RANDOM = new SecureRandom();
    private static final int TOKEN_BYTES = 32;

    private final AuthSessionStore sessionStore;
    private final AuthProperties properties;

    public RefreshTokenService(AuthSessionStore sessionStore, AuthProperties properties) {
        this.sessionStore = sessionStore;
        this.properties = properties;
    }

    public IssuedSession create(Long userId) {
        String sessionId = UUID.randomUUID().toString();
        String token = tokenValue(sessionId);
        Instant expiresAt = Instant.now().plus(properties.refreshTokenTtl());

        sessionStore.create(
                new AuthSession(sessionId, userId, hash(token), expiresAt),
                properties.maxSessionsPerUser(),
                properties.refreshTokenTtl()
        );
        return new IssuedSession(sessionId, new IssuedRefreshToken(token, expiresAt));
    }

    public IssuedSession rotate(String token) {
        String sessionId = extractSessionId(token);
        AuthSession session = sessionStore.find(sessionId)
                .orElseThrow(() -> new BusinessException(AuthErrorCode.AUTH_INVALID_REFRESH_TOKEN));

        String currentHash = hash(token);
        if (!MessageDigest.isEqual(
                session.refreshTokenHash().getBytes(StandardCharsets.UTF_8),
                currentHash.getBytes(StandardCharsets.UTF_8)
        )) {
            throw new BusinessException(AuthErrorCode.AUTH_INVALID_REFRESH_TOKEN);
        }

        String rotatedToken = tokenValue(sessionId);
        boolean rotated = sessionStore.rotate(
                sessionId,
                currentHash,
                hash(rotatedToken),
                session.expiresAt()
        );
        if (!rotated) {
            throw new BusinessException(AuthErrorCode.AUTH_INVALID_REFRESH_TOKEN);
        }

        return new IssuedSession(
                sessionId,
                new IssuedRefreshToken(rotatedToken, session.expiresAt())
        );
    }

    public void revokeByToken(String token) {
        if (token == null || token.isBlank()) {
            return;
        }
        try {
            sessionStore.revoke(extractSessionId(token));
        } catch (BusinessException ignored) {
            // 로그아웃은 이미 만료되거나 폐기된 쿠키가 와도 같은 결과를 냅니다.
        }
    }

    private String tokenValue(String sessionId) {
        byte[] random = new byte[TOKEN_BYTES];
        SECURE_RANDOM.nextBytes(random);
        return sessionId + "." + Base64.getUrlEncoder().withoutPadding().encodeToString(random);
    }

    private String extractSessionId(String token) {
        if (token == null) {
            throw new BusinessException(AuthErrorCode.AUTH_INVALID_REFRESH_TOKEN);
        }
        int separator = token.indexOf('.');
        if (separator <= 0 || separator == token.length() - 1) {
            throw new BusinessException(AuthErrorCode.AUTH_INVALID_REFRESH_TOKEN);
        }
        try {
            return UUID.fromString(token.substring(0, separator)).toString();
        } catch (IllegalArgumentException exception) {
            throw new BusinessException(AuthErrorCode.AUTH_INVALID_REFRESH_TOKEN);
        }
    }

    private String hash(String token) {
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256")
                    .digest(token.getBytes(StandardCharsets.UTF_8));
            return Base64.getUrlEncoder().withoutPadding().encodeToString(digest);
        } catch (NoSuchAlgorithmException exception) {
            throw new IllegalStateException("SHA-256 is unavailable", exception);
        }
    }

    public record IssuedSession(String sessionId, IssuedRefreshToken refreshToken) {
    }
}
