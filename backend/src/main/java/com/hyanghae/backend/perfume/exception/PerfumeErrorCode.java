package com.hyanghae.backend.perfume.exception;

import com.hyanghae.backend.global.exception.ErrorCode;
import org.springframework.http.HttpStatus;

/**
 * 향수 도메인의 에러 코드입니다.
 *
 * <p>상수 이름이 그대로 응답의 {@code code}가 되므로, 다른 도메인과 겹치지 않도록
 * 이름에 {@code PERFUME_} 접두사를 붙입니다. {@link PerfumeErrorCodeTest}가 이 규칙을 강제합니다.
 */
public enum PerfumeErrorCode implements ErrorCode {

    PERFUME_NOT_FOUND(HttpStatus.NOT_FOUND, "향수를 찾을 수 없습니다."),

    /**
     * 진열대 필터는 "나와 이 향수의 관계"를 묻는 조건이라 요청자가 누구인지 알아야 합니다.
     * 비로그인 요청에 조용히 전체를 돌려주면 필터가 걸린 것처럼 보이지만 남의 자료가 섞입니다.
     */
    PERFUME_SHELF_FILTER_REQUIRES_LOGIN(HttpStatus.UNAUTHORIZED, "진열대 필터는 로그인이 필요합니다.");

    private final HttpStatus status;
    private final String message;

    PerfumeErrorCode(HttpStatus status, String message) {
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
