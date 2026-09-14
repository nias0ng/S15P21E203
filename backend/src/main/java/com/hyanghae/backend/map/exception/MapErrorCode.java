package com.hyanghae.backend.map.exception;

import com.hyanghae.backend.global.exception.ErrorCode;
import org.springframework.http.HttpStatus;

/**
 * 향 지도 도메인의 에러 코드입니다.
 *
 * <p>상수 이름이 그대로 응답의 {@code code}가 되므로, 다른 도메인과 겹치지 않도록 이름에
 * {@code MAP_} 접두사를 붙입니다. {@link MapErrorCodeTest}가 이 규칙을 강제합니다.
 */
public enum MapErrorCode implements ErrorCode {

    MAP_PERFUME_NOT_FOUND(HttpStatus.NOT_FOUND, "지도에서 향수를 찾을 수 없습니다."),
    MAP_LOGIN_REQUIRED(HttpStatus.UNAUTHORIZED, "로그인이 필요합니다."),
    MAP_EXPLORATION_POINT_REQUIRED(
            HttpStatus.BAD_REQUEST, "향수 번호나 좌표 중 하나는 보내야 합니다.");

    private final HttpStatus status;
    private final String message;

    MapErrorCode(HttpStatus status, String message) {
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
