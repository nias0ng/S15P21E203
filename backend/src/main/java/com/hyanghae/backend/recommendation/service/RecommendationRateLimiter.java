package com.hyanghae.backend.recommendation.service;

import com.hyanghae.backend.global.exception.BusinessException;
import com.hyanghae.backend.global.security.CurrentUser;
import com.hyanghae.backend.recommendation.client.RecommendationProperties;
import com.hyanghae.backend.recommendation.exception.RecommendationErrorCode;
import java.util.List;
import java.util.Optional;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.script.DefaultRedisScript;
import org.springframework.stereotype.Component;

/**
 * 자연어 추천을 너무 자주 부르지 못하게 막습니다.
 *
 * <p>추천 한 번이 AI 서버의 LLM 호출로 이어집니다. 비용이 나가고, 실측 중앙값이 1.47초라
 * 동시에 몰리면 AI 서버가 먼저 막힙니다. <b>AI 서버는 외부에 열려 있지 않고 스스로를 지키지
 * 않습니다</b> — 인증도 호출량 제한도 전부 이 백엔드가 합니다. 여기서 안 막으면 막는 곳이
 * 없습니다.
 *
 * <p>회원은 사용자 번호로, 비회원은 IP 로 셉니다. 계약서가 "비회원도 호출할 수 있고 차이는
 * 호출량 제한뿐" 이라고 정했습니다. 한도는
 * {@link RecommendationProperties.RateLimit} 에 있습니다.
 *
 * <h2>⚠ 배포 앞단에 프록시가 있으면 설정이 하나 필요합니다</h2>
 *
 * <p>비회원의 IP 는 {@code HttpServletRequest#getRemoteAddr()} 입니다. 앞에 nginx 같은
 * 리버스 프록시가 있으면 이 값이 <b>전부 프록시의 IP</b>가 되어, 비회원 전체가 한 바구니를
 * 나눠 쓰게 됩니다. 그러면 몇 명만 불러도 나머지가 429 를 받습니다.
 *
 * <p>고치는 방법은 {@code server.forward-headers-strategy=framework} 입니다. Spring 이
 * {@code X-Forwarded-For} 를 읽어 {@code getRemoteAddr()} 가 실제 클라이언트 IP 를 돌려줍니다.
 * <b>이 코드에서 헤더를 직접 파싱하지 않는 이유</b>이기도 합니다 — 직접 믿으면 아무나 헤더를
 * 넣어 제한을 우회합니다. 프레임워크 설정으로 두면 "프록시를 거친 요청만 신뢰한다" 를 배포
 * 구성에서 정할 수 있습니다.
 *
 * <p>그래서 기본값을 켜 두지 않았습니다. 백엔드 포트가 외부에 직접 열려 있는데 켜면 헤더를
 * 넣어 제한을 우회할 수 있습니다. 어느 쪽인지는 배포 구성을 아는 쪽만 판단할 수 있습니다.
 * {@code application-prod.yaml} 의 {@code FORWARD_HEADERS_STRATEGY} 를 보십시오.
 */
@Component
public class RecommendationRateLimiter {

    private static final Logger log = LoggerFactory.getLogger(RecommendationRateLimiter.class);

    private static final String KEY_PREFIX = "recommendation:rate:";

    /**
     * 세면서 구간을 여는 스크립트입니다.
     *
     * <p>{@code INCR} 과 {@code PEXPIRE} 를 따로 부르면 사이에서 죽었을 때 <b>만료 시각이 없는
     * 키</b>가 남습니다. 그 사용자는 영원히 막힙니다. 스크립트로 묶으면 그 틈이 없습니다.
     * 인증 세션 저장소가 같은 이유로 스크립트를 씁니다.
     *
     * <p>첫 호출에서만 만료를 겁니다. 매번 걸면 부를 때마다 구간이 밀려, 계속 부르는 동안
     * 영원히 끝나지 않는 구간이 됩니다.
     */
    private static final DefaultRedisScript<Long> COUNT_SCRIPT = new DefaultRedisScript<>("""
            local count = redis.call('INCR', KEYS[1])
            if count == 1 then
              redis.call('PEXPIRE', KEYS[1], ARGV[1])
            end
            return count
            """, Long.class);

    private final StringRedisTemplate redisTemplate;
    private final CurrentUser currentUser;
    private final RecommendationProperties properties;

    public RecommendationRateLimiter(
            StringRedisTemplate redisTemplate,
            CurrentUser currentUser,
            RecommendationProperties properties
    ) {
        this.redisTemplate = redisTemplate;
        this.currentUser = currentUser;
        this.properties = properties;
    }

    /**
     * 한도를 넘었으면 막습니다.
     *
     * @param clientIp 비회원을 구분할 IP 입니다. 회원이면 쓰지 않습니다.
     * @throws BusinessException 한도를 넘었습니다. 429 로 나갑니다.
     */
    public void check(String clientIp) {
        Optional<Long> userId = currentUser.id();
        boolean member = userId.isPresent();

        RecommendationProperties.RateLimit rateLimit = properties.rateLimit();
        int limit = member ? rateLimit.member() : rateLimit.anonymous();
        String key = KEY_PREFIX + (member ? "user:" + userId.get() : "ip:" + clientIp);

        Long count = redisTemplate.execute(
                COUNT_SCRIPT, List.of(key), Long.toString(rateLimit.window().toMillis()));

        if (count != null && count > limit) {
            log.warn("자연어 추천 호출량 제한에 걸렸습니다: subjectType={}, limit={}, windowSeconds={}",
                    member ? "user" : "ip", limit, rateLimit.window().toSeconds());
            throw new BusinessException(RecommendationErrorCode.RECOMMENDATION_RATE_LIMIT_EXCEEDED);
        }
    }
}
