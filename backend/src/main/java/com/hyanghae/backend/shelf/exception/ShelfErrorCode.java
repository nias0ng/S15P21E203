package com.hyanghae.backend.shelf.exception;

import com.hyanghae.backend.global.exception.ErrorCode;
import org.springframework.http.HttpStatus;

public enum ShelfErrorCode implements ErrorCode {

    SHELF_LOGIN_REQUIRED(HttpStatus.UNAUTHORIZED, "로그인이 필요합니다."),
    SHELF_ITEM_NOT_FOUND(HttpStatus.NOT_FOUND, "진열대 항목을 찾을 수 없습니다."),
    SHELF_PERFUME_NOT_FOUND(HttpStatus.NOT_FOUND, "저장할 향수를 찾을 수 없습니다."),
    SHELF_ITEM_ALREADY_EXISTS(HttpStatus.CONFLICT, "이미 진열대에 저장된 향수입니다."),
    SHELF_MEMO_NOT_FOUND(HttpStatus.NOT_FOUND, "메모를 찾을 수 없습니다."),
    SHELF_MEMO_ALREADY_EXISTS(HttpStatus.CONFLICT, "이미 메모가 존재합니다."),
    SHELF_INVALID_FIT_RATING(
            HttpStatus.BAD_REQUEST,
            "취향 적합도는 1.0부터 5.0까지 0.5 단위로 입력해야 합니다."
    ),
    SHELF_REPRESENTATIVE_REQUIRES_OWNED(
            HttpStatus.BAD_REQUEST,
            "보유 중인 향수만 대표 향수로 지정할 수 있습니다."
    );

    private final HttpStatus status;
    private final String message;

    ShelfErrorCode(HttpStatus status, String message) {
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
