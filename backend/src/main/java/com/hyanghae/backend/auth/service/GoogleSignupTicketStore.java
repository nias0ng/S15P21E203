package com.hyanghae.backend.auth.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.hyanghae.backend.auth.config.AuthProperties;
import java.util.Optional;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Component;

/**
 * Google 확인은 마쳤지만 아직 닉네임을 정하지 않은 사람의 가입표입니다.
 *
 * <p>Google 에서 돌아온 요청과 닉네임을 보내는 요청이 서로 다르므로, 그 사이에 "이 사람은 이 Google
 * 계정의 주인"이라는 사실을 서버가 짧게 기억합니다. 표 값은 HttpOnly 쿠키로만 오가고 주소에는 싣지
 * 않습니다.
 *
 * <p>가입이 끝나야 지웁니다. 닉네임이 겹쳐 실패했을 때 Google 로그인부터 다시 하게 하지 않기
 * 위해서입니다. 같은 표로 두 번 가입하는 것은 {@code uk_users_google_subject} 가 막습니다.
 */
@Component
public class GoogleSignupTicketStore {

    private static final String PREFIX = "auth:google-signup:";

    private final StringRedisTemplate redisTemplate;
    private final ObjectMapper objectMapper;
    private final AuthProperties properties;

    public GoogleSignupTicketStore(
            StringRedisTemplate redisTemplate,
            ObjectMapper objectMapper,
            AuthProperties properties
    ) {
        this.redisTemplate = redisTemplate;
        this.objectMapper = objectMapper;
        this.properties = properties;
    }

    public String issue(GoogleIdentity identity) {
        String ticket = OpaqueTokens.random();
        try {
            redisTemplate.opsForValue().set(
                    key(ticket),
                    objectMapper.writeValueAsString(identity),
                    properties.google().signupTicketTtl()
            );
        } catch (JsonProcessingException exception) {
            throw new IllegalStateException("Google identity is not serializable", exception);
        }
        return ticket;
    }

    public Optional<GoogleIdentity> find(String ticket) {
        if (ticket == null || ticket.isBlank()) {
            return Optional.empty();
        }
        String stored = redisTemplate.opsForValue().get(key(ticket));
        if (stored == null) {
            return Optional.empty();
        }
        try {
            return Optional.of(objectMapper.readValue(stored, GoogleIdentity.class));
        } catch (JsonProcessingException exception) {
            throw new IllegalStateException("Stored Google signup ticket is corrupted", exception);
        }
    }

    public void delete(String ticket) {
        redisTemplate.delete(key(ticket));
    }

    private String key(String ticket) {
        return PREFIX + OpaqueTokens.sha256(ticket);
    }
}
