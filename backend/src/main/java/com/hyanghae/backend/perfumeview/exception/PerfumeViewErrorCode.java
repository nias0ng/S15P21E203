package com.hyanghae.backend.perfumeview.exception;

import com.hyanghae.backend.global.exception.ErrorCode;
import org.springframework.http.HttpStatus;

public enum PerfumeViewErrorCode implements ErrorCode {

    PERFUME_VIEW_LOGIN_REQUIRED(HttpStatus.UNAUTHORIZED, "로그인이 필요합니다."),
    PERFUME_VIEW_NOT_FOUND(HttpStatus.NOT_FOUND, "향수 상세 조회 기록을 찾을 수 없습니다."),
    PERFUME_VIEW_SOURCE_NOT_FOUND(HttpStatus.NOT_FOUND, "유입 경로의 향수를 찾을 수 없습니다."),
    PERFUME_VIEW_INVALID_SOURCE(
            HttpStatus.BAD_REQUEST,
            "연관 향수 유입 경로와 이전 향수 ID를 확인해주세요."
    );

    private final HttpStatus status;
    private final String message;

    PerfumeViewErrorCode(HttpStatus status, String message) {
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
