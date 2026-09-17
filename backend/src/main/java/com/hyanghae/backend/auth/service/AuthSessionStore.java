package com.hyanghae.backend.auth.service;

import java.time.Duration;
import java.time.Instant;
import java.util.Optional;

public interface AuthSessionStore {

    void create(AuthSession session, int maxSessions, Duration ttl);

    Optional<AuthSession> find(String sessionId);

    boolean rotate(String sessionId, String expectedHash, String newHash, Instant expiresAt);

    boolean isActive(String sessionId, Long userId);

    void revoke(String sessionId);

    void revokeAll(Long userId);
}
