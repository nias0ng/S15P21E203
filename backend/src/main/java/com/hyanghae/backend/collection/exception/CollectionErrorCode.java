package com.hyanghae.backend.collection.exception;

import com.hyanghae.backend.global.exception.ErrorCode;
import org.springframework.http.HttpStatus;

public enum CollectionErrorCode implements ErrorCode {
    COLLECTION_LOGIN_REQUIRED(HttpStatus.UNAUTHORIZED, "로그인이 필요합니다."),
    COLLECTION_NOT_FOUND(HttpStatus.NOT_FOUND, "컬렉션을 찾을 수 없습니다."),
    COLLECTION_SHELF_ITEM_NOT_FOUND(HttpStatus.NOT_FOUND, "내 진열대 항목을 찾을 수 없습니다."),
    COLLECTION_NAME_ALREADY_EXISTS(HttpStatus.CONFLICT, "이미 사용 중인 컬렉션 이름입니다."),
    COLLECTION_INVALID_REQUEST(HttpStatus.BAD_REQUEST, "컬렉션 요청을 확인해주세요.");

    private final HttpStatus status;
    private final String message;

    CollectionErrorCode(HttpStatus status, String message) {
        this.status = status;
        this.message = message;
    }

    public HttpStatus status() { return status; }
    public String message() { return message; }
}
