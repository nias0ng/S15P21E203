package com.hyanghae.backend.perfume;

import com.hyanghae.backend.common.ErrorCode;
import org.springframework.http.HttpStatus;

/**
 * 향수 도메인의 에러 코드입니다.
 *
 * <p>상수 이름이 그대로 응답의 {@code code}가 되므로, 다른 도메인과 겹치지 않도록
 * 이름에 {@code PERFUME_} 접두사를 붙입니다.
 */
public enum PerfumeErrorCode implements ErrorCode {

    PERFUME_NOT_FOUND(HttpStatus.NOT_FOUND, "향수를 찾을 수 없습니다.");

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
    public String code() {
        return name();
    }

    @Override
    public String message() {
        return message;
    }
}
