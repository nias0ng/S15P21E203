package com.hyanghae.backend.recommendation.exception;

import com.hyanghae.backend.global.exception.ErrorCode;
import org.springframework.http.HttpStatus;

/**
 * 자연어 추천 도메인의 에러 코드입니다.
 *
 * <p>상수 이름이 그대로 응답의 {@code code} 가 되므로 {@code RECOMMENDATION_} 접두사를 붙입니다.
 *
 * <p>요청 형식 오류(빈 {@code query}, 500자 초과)는 여기 없습니다. 요청 DTO 의 Bean Validation
 * 이 잡아 {@code GlobalExceptionHandler} 가 {@code BAD_REQUEST} 로 내보냅니다.
 */
public enum RecommendationErrorCode implements ErrorCode {

    /**
     * AI 서버가 응답하지 않거나 제한 시간을 넘겼습니다.
     *
     * <p>503 입니다. 추천 화면에서만 실패를 알리고 다른 기능은 살아 있어야 합니다. AI 서버가
     * 죽었다는 것은 이 서비스의 장애가 아니라 한 기능을 지금 쓸 수 없다는 뜻입니다.
     *
     * <p>메시지에 사용자가 쓴 문장이나 AI 서버의 응답 본문을 담지 않습니다. 에러 응답은 그대로
     * 로그에 남습니다.
     */
    RECOMMENDATION_AI_UNAVAILABLE(HttpStatus.SERVICE_UNAVAILABLE,
            "추천 서비스를 지금 이용할 수 없습니다. 잠시 뒤 다시 시도해 주세요."),

    /**
     * 정해진 시간 안에 너무 많이 불렀습니다.
     *
     * <p>429 입니다. 추천 한 번이 AI 서버의 LLM 호출로 이어져 비용이 나가고, 그 호출이
     * 중앙값 1.47초라 동시에 몰리면 AI 서버가 먼저 막힙니다. 인증·호출량 제한은 전부 이
     * 백엔드가 합니다 — AI 서버는 외부에 열려 있지 않고 스스로를 지키지 않습니다.
     *
     * <p>비회원이 회원보다 적게 부를 수 있습니다. 결과는 같지만 한도가 다릅니다.
     */
    RECOMMENDATION_RATE_LIMIT_EXCEEDED(HttpStatus.TOO_MANY_REQUESTS,
            "추천을 너무 자주 요청했습니다. 잠시 뒤 다시 시도해 주세요.");

    private final HttpStatus status;
    private final String message;

    RecommendationErrorCode(HttpStatus status, String message) {
        this.status = status;
        this.message = message;
    }

    @Override
    public HttpStatus status() {
        return status;
    }

    @Override
    public String message() {
        return message;
    }
}
