package com.hyanghae.backend.auth.service;

import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.script.DefaultRedisScript;
import org.springframework.stereotype.Component;

@Component
public class RedisAuthSessionStore implements AuthSessionStore {

    private static final String SESSION_PREFIX = "auth:session:";
    private static final String USER_SESSIONS_PREFIX = "auth:user-sessions:";
    private static final String SEPARATOR = "|";

    private static final DefaultRedisScript<Long> CREATE_SCRIPT = new DefaultRedisScript<>("""
            redis.call('ZADD', KEYS[1], ARGV[1], ARGV[2])
            redis.call('SET', KEYS[2], ARGV[3], 'PX', ARGV[4])
            while redis.call('ZCARD', KEYS[1]) > tonumber(ARGV[5]) do
              local oldest = redis.call('ZRANGE', KEYS[1], 0, 0)[1]
              if not oldest then break end
              redis.call('ZREM', KEYS[1], oldest)
              redis.call('DEL', ARGV[6] .. oldest)
            end
            redis.call('PEXPIRE', KEYS[1], ARGV[4])
            return 1
            """, Long.class);

    private static final DefaultRedisScript<Long> ROTATE_SCRIPT = new DefaultRedisScript<>("""
            if redis.call('GET', KEYS[1]) ~= ARGV[1] then
              return 0
            end
            redis.call('SET', KEYS[1], ARGV[2], 'PX', ARGV[3])
            return 1
            """, Long.class);

    private final StringRedisTemplate redisTemplate;

    public RedisAuthSessionStore(StringRedisTemplate redisTemplate) {
        this.redisTemplate = redisTemplate;
    }

    @Override
    public void create(AuthSession session, int maxSessions, Duration ttl) {
        redisTemplate.execute(
                CREATE_SCRIPT,
                List.of(userSessionsKey(session.userId()), sessionKey(session.sessionId())),
                Long.toString(Instant.now().toEpochMilli()),
                session.sessionId(),
                serialize(session),
                Long.toString(ttl.toMillis()),
                Integer.toString(maxSessions),
                SESSION_PREFIX
        );
    }

    @Override
    public Optional<AuthSession> find(String sessionId) {
        String stored = redisTemplate.opsForValue().get(sessionKey(sessionId));
        return stored == null ? Optional.empty() : Optional.of(deserialize(sessionId, stored));
    }

    @Override
    public boolean rotate(String sessionId, String expectedHash, String newHash, Instant expiresAt) {
        Optional<AuthSession> found = find(sessionId);
        if (found.isEmpty() || !found.get().refreshTokenHash().equals(expectedHash)) {
            return false;
        }

        Duration remaining = Duration.between(Instant.now(), expiresAt);
        if (remaining.isNegative() || remaining.isZero()) {
            revoke(sessionId);
            return false;
        }

        AuthSession rotated = new AuthSession(sessionId, found.get().userId(), newHash, expiresAt);
        Long result = redisTemplate.execute(
                ROTATE_SCRIPT,
                List.of(sessionKey(sessionId)),
                serialize(found.get()),
                serialize(rotated),
                Long.toString(remaining.toMillis())
        );
        return Long.valueOf(1).equals(result);
    }

    @Override
    public boolean isActive(String sessionId, Long userId) {
        return find(sessionId).map(session -> session.userId().equals(userId)).orElse(false);
    }

    @Override
    public void revoke(String sessionId) {
        Optional<AuthSession> found = find(sessionId);
        redisTemplate.delete(sessionKey(sessionId));
        found.ifPresent(session -> redisTemplate.opsForZSet()
                .remove(userSessionsKey(session.userId()), sessionId));
    }

    @Override
    public void revokeAll(Long userId) {
        String userSessionsKey = userSessionsKey(userId);
        var sessionIds = redisTemplate.opsForZSet().range(userSessionsKey, 0, -1);
        if (sessionIds != null && !sessionIds.isEmpty()) {
            redisTemplate.delete(sessionIds.stream().map(this::sessionKey).toList());
        }
        redisTemplate.delete(userSessionsKey);
    }

    private String serialize(AuthSession session) {
        return session.userId() + SEPARATOR
                + session.refreshTokenHash() + SEPARATOR
                + session.expiresAt().toEpochMilli();
    }

    private AuthSession deserialize(String sessionId, String stored) {
        String[] values = stored.split("\\|", -1);
        if (values.length != 3) {
            throw new IllegalStateException("Invalid authentication session value");
        }
        return new AuthSession(
                sessionId,
                Long.valueOf(values[0]),
                values[1],
                Instant.ofEpochMilli(Long.parseLong(values[2]))
        );
    }

    private String sessionKey(String sessionId) {
        return SESSION_PREFIX + sessionId;
    }

    private String userSessionsKey(Long userId) {
        return USER_SESSIONS_PREFIX + userId;
    }
}
