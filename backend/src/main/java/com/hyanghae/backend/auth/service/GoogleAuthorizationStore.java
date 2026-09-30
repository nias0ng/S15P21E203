package com.hyanghae.backend.auth.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.hyanghae.backend.auth.config.AuthProperties;
import java.time.Duration;
import java.util.Optional;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Component;

/**
 * Google 로그인 화면에 보낸 요청을 돌아올 때까지 기억합니다.
 *
 * <p>Google 에서 돌아온 요청이 우리가 보낸 것인지(state), 가로챈 code 가 아닌지(PKCE), 다른 시도의
 * 토큰이 아닌지(nonce)를 이 기록으로 확인합니다. 한 번 꺼내면 지웁니다 — 같은 state 로 두 번 돌아올
 * 수 없습니다.
 *
 * <p>탈퇴 전 Google 재확인이 끝났다는 표시도 여기에 둡니다. 확인과 탈퇴가 서로 다른 요청이라 그 사이를
 * 이어 줄 곳이 필요합니다.
 */
@Component
public class GoogleAuthorizationStore {

    private static final String AUTHORIZATION_PREFIX = "auth:google-authorization:";
    private static final String REAUTH_PREFIX = "auth:google-reauth:";

    /** Google 재확인을 마치고 탈퇴 버튼을 누를 때까지 주는 시간입니다. */
    private static final Duration REAUTH_TTL = Duration.ofMinutes(5);

    private final StringRedisTemplate redisTemplate;
    private final ObjectMapper objectMapper;
    private final AuthProperties properties;

    public GoogleAuthorizationStore(
            StringRedisTemplate redisTemplate,
            ObjectMapper objectMapper,
            AuthProperties properties
    ) {
        this.redisTemplate = redisTemplate;
        this.objectMapper = objectMapper;
        this.properties = properties;
    }

    public void save(String state, Authorization authorization) {
        redisTemplate.opsForValue().set(
                AUTHORIZATION_PREFIX + OpaqueTokens.sha256(state),
                write(authorization),
                properties.google().authorizationTtl()
        );
    }

    public Optional<Authorization> consume(String state) {
        if (state == null || state.isBlank()) {
            return Optional.empty();
        }
        String stored = redisTemplate.opsForValue()
                .getAndDelete(AUTHORIZATION_PREFIX + OpaqueTokens.sha256(state));
        return Optional.ofNullable(stored).map(this::read);
    }

    public void grantReauth(Long userId) {
        redisTemplate.opsForValue().set(REAUTH_PREFIX + userId, "1", REAUTH_TTL);
    }

    /** 재확인 표시가 있으면 지우고 참을 돌려줍니다. 한 번의 확인으로 한 번만 탈퇴할 수 있습니다. */
    public boolean consumeReauth(Long userId) {
        return redisTemplate.opsForValue().getAndDelete(REAUTH_PREFIX + userId) != null;
    }

    private String write(Authorization authorization) {
        try {
            return objectMapper.writeValueAsString(authorization);
        } catch (JsonProcessingException exception) {
            throw new IllegalStateException("Google authorization is not serializable", exception);
        }
    }

    private Authorization read(String stored) {
        try {
            return objectMapper.readValue(stored, Authorization.class);
        } catch (JsonProcessingException exception) {
            throw new IllegalStateException("Stored Google authorization is corrupted", exception);
        }
    }

    public enum Purpose {
        /** 로그인 또는 가입 */
        LOGIN,
        /** 로그인한 사람이 탈퇴 전에 본인임을 다시 확인 */
        REAUTH
    }

    /**
     * @param userId   {@code REAUTH} 일 때 확인을 요청한 사람. {@code LOGIN} 이면 {@code null}
     * @param returnTo 로그인 뒤 돌아갈 화면 경로. 없으면 {@code null}
     */
    public record Authorization(
            Purpose purpose,
            Long userId,
            String codeVerifier,
            String nonce,
            String returnTo
    ) {
    }
}
