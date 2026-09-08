package com.hyanghae.backend.global.response;

/**
 * 모든 에러 응답의 공통 형식입니다.
 *
 * <p>프론트엔드의 {@code ApiErrorResponse}(shared/api/http.ts)와 필드가 1:1로 맞아야 합니다.
 * 필드를 바꾸면 프론트엔드의 에러 처리가 함께 깨집니다.
 */
public record ApiErrorResponse(String code, String message) {
}
