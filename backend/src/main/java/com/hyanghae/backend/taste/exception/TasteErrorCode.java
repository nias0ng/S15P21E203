package com.hyanghae.backend.taste.exception;

import com.hyanghae.backend.global.exception.ErrorCode;
import org.springframework.http.HttpStatus;

/**
 * 취향 테스트 도메인의 에러 코드입니다.
 *
 * <p>상수 이름이 그대로 응답의 {@code code} 가 되므로 {@code TASTE_} 접두사를 붙입니다.
 */
public enum TasteErrorCode implements ErrorCode {

    TASTE_LOGIN_REQUIRED(HttpStatus.UNAUTHORIZED, "로그인이 필요합니다."),
    TASTE_ALREADY_COMPLETED(HttpStatus.CONFLICT, "이미 취향 테스트를 마쳤습니다."),
    TASTE_PICKS_REQUIRED(HttpStatus.BAD_REQUEST, "향 계열을 1개 또는 2개 골라야 합니다."),
    TASTE_PICKS_DUPLICATED(HttpStatus.BAD_REQUEST, "같은 향 계열을 두 번 고를 수 없습니다."),
    TASTE_UNKNOWN_SCENT_REGION(HttpStatus.BAD_REQUEST, "없는 향 계열입니다."),
    TASTE_PERFUME_NOT_ON_MAP(HttpStatus.BAD_REQUEST, "향 지도에 없는 향수입니다.");

    private final HttpStatus status;
    private final String message;

    TasteErrorCode(HttpStatus status, String message) {
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
