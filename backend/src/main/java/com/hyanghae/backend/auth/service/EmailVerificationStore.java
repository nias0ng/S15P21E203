package com.hyanghae.backend.auth.service;

import java.time.Duration;
import java.util.List;
import java.util.Optional;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.script.DefaultRedisScript;
import org.springframework.stereotype.Component;

/**
 * 이메일 인증 상태를 Redis 에 둡니다.
 *
 * <p>검사와 변경이 한 번에 일어나야 하는 곳은 Lua 스크립트로 묶습니다. 따로 부르면 같은
 * 이메일로 동시에 들어온 요청이 둘 다 "아직 안 보냈다", "아직 덜 틀렸다" 를 보고 지나갑니다.
 */
@Component
public class EmailVerificationStore {

    private static final String CODE_PREFIX = "auth:email-verification:";
    private static final String COOLDOWN_PREFIX = "auth:email-verification-cooldown:";
    private static final String SENDS_PREFIX = "auth:email-verification-sends:";
    private static final String VERIFIED_PREFIX = "auth:email-verified:";

    private static final String HASH_FIELD = "hash";
    private static final String ATTEMPTS_FIELD = "attempts";

    private static final DefaultRedisScript<Long> RESERVE_SEND_SCRIPT = new DefaultRedisScript<>("""
            if redis.call('EXISTS', KEYS[1]) == 1 then
              return -1
            end
            local sends = tonumber(redis.call('GET', KEYS[2]) or '0')
            if sends >= tonumber(ARGV[2]) then
              return -2
            end
            redis.call('SET', KEYS[1], '1', 'PX', ARGV[1])
            sends = redis.call('INCR', KEYS[2])
            if sends == 1 then
              redis.call('PEXPIRE', KEYS[2], ARGV[3])
            end
            return 1
            """, Long.class);

    private static final DefaultRedisScript<Long> RELEASE_SEND_SCRIPT = new DefaultRedisScript<>("""
            redis.call('DEL', KEYS[1])
            if tonumber(redis.call('GET', KEYS[2]) or '0') > 0 then
              redis.call('DECR', KEYS[2])
            end
            return 1
            """, Long.class);

    private static final DefaultRedisScript<Long> SAVE_CODE_SCRIPT = new DefaultRedisScript<>("""
            redis.call('DEL', KEYS[1])
            redis.call('HSET', KEYS[1], ARGV[1], ARGV[2], ARGV[3], '0')
            redis.call('PEXPIRE', KEYS[1], ARGV[4])
            return 1
            """, Long.class);

    // 읽은 해시가 그대로일 때만 지웁니다. 그사이 새 번호를 받았다면 그 번호는 살아 있어야 합니다.
    private static final DefaultRedisScript<Long> CONSUME_CODE_SCRIPT = new DefaultRedisScript<>("""
            if redis.call('HGET', KEYS[1], ARGV[1]) ~= ARGV[2] then
              return 0
            end
            redis.call('DEL', KEYS[1])
            return 1
            """, Long.class);

    private static final DefaultRedisScript<Long> RECORD_FAILURE_SCRIPT = new DefaultRedisScript<>("""
            if redis.call('HGET', KEYS[1], ARGV[1]) ~= ARGV[2] then
              return 0
            end
            local attempts = redis.call('HINCRBY', KEYS[1], ARGV[3], 1)
            if attempts >= tonumber(ARGV[4]) then
              redis.call('DEL', KEYS[1])
            end
            return attempts
            """, Long.class);

    private final StringRedisTemplate redisTemplate;

    public EmailVerificationStore(StringRedisTemplate redisTemplate) {
        this.redisTemplate = redisTemplate;
    }

    /** 재전송 대기와 시간당 횟수를 확인하고, 통과하면 둘 다 한 번 쓴 것으로 적습니다. */
    public SendReservation reserveSend(
            String email,
            Duration cooldown,
            int maxSends,
            Duration window
    ) {
        Long result = redisTemplate.execute(
                RESERVE_SEND_SCRIPT,
                List.of(cooldownKey(email), sendsKey(email)),
                Long.toString(cooldown.toMillis()),
                Integer.toString(maxSends),
                Long.toString(window.toMillis())
        );
        if (Long.valueOf(-1).equals(result)) {
            return SendReservation.COOLDOWN;
        }
        if (Long.valueOf(-2).equals(result)) {
            return SendReservation.LIMIT_EXCEEDED;
        }
        return SendReservation.RESERVED;
    }

    /** 메일을 보내지 못했을 때 되돌립니다. 보내지도 못한 요청으로 기다리게 하면 안 됩니다. */
    public void releaseSend(String email) {
        redisTemplate.execute(
                RELEASE_SEND_SCRIPT,
                List.of(cooldownKey(email), sendsKey(email))
        );
    }

    /** 이전 번호와 틀린 횟수를 지우고 새 번호로 바꿉니다. */
    public void saveCode(String email, String codeHash, Duration ttl) {
        redisTemplate.execute(
                SAVE_CODE_SCRIPT,
                List.of(codeKey(email)),
                HASH_FIELD,
                codeHash,
                ATTEMPTS_FIELD,
                Long.toString(ttl.toMillis())
        );
    }

    public Optional<String> findCodeHash(String email) {
        Object stored = redisTemplate.opsForHash().get(codeKey(email), HASH_FIELD);
        return Optional.ofNullable(stored).map(Object::toString);
    }

    public boolean consumeCode(String email, String codeHash) {
        Long result = redisTemplate.execute(
                CONSUME_CODE_SCRIPT,
                List.of(codeKey(email)),
                HASH_FIELD,
                codeHash
        );
        return Long.valueOf(1).equals(result);
    }

    /**
     * 틀린 횟수를 하나 올리고 올린 뒤의 횟수를 돌려줍니다. 한도에 닿으면 번호를 지웁니다.
     * 번호가 이미 없거나 바뀌었으면 0 입니다.
     */
    public long recordFailure(String email, String codeHash, int maxAttempts) {
        Long result = redisTemplate.execute(
                RECORD_FAILURE_SCRIPT,
                List.of(codeKey(email)),
                HASH_FIELD,
                codeHash,
                ATTEMPTS_FIELD,
                Integer.toString(maxAttempts)
        );
        return result == null ? 0 : result;
    }

    public void saveVerified(String token, String email, Duration ttl) {
        redisTemplate.opsForValue().set(verifiedKey(token), email, ttl);
    }

    public Optional<String> findVerifiedEmail(String token) {
        return Optional.ofNullable(redisTemplate.opsForValue().get(verifiedKey(token)));
    }

    public void deleteVerified(String token) {
        redisTemplate.delete(verifiedKey(token));
    }

    private String codeKey(String email) {
        return CODE_PREFIX + email;
    }

    private String cooldownKey(String email) {
        return COOLDOWN_PREFIX + email;
    }

    private String sendsKey(String email) {
        return SENDS_PREFIX + email;
    }

    private String verifiedKey(String token) {
        return VERIFIED_PREFIX + token;
    }

    public enum SendReservation {
        RESERVED,
        COOLDOWN,
        LIMIT_EXCEEDED
    }
}
