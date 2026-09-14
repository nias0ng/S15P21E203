package com.hyanghae.backend.review.exception;

import com.hyanghae.backend.global.exception.ErrorCode;
import org.springframework.http.HttpStatus;

public enum ReviewErrorCode implements ErrorCode {

    REVIEW_LOGIN_REQUIRED(HttpStatus.UNAUTHORIZED, "로그인이 필요합니다."),
    REVIEW_NOT_FOUND(HttpStatus.NOT_FOUND, "후기를 찾을 수 없습니다."),
    REVIEW_ALREADY_EXISTS(HttpStatus.CONFLICT, "이미 작성한 후기가 존재합니다."),
    REVIEW_SEASON_NOT_FOUND(HttpStatus.NOT_FOUND, "계절을 찾을 수 없습니다."),
    REVIEW_INVALID_SEASONS(HttpStatus.BAD_REQUEST, "계절 선택을 확인해주세요.");

    private final HttpStatus status;
    private final String message;

    ReviewErrorCode(HttpStatus status, String message) {
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
