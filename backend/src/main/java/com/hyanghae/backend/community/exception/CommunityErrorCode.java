package com.hyanghae.backend.community.exception;

import com.hyanghae.backend.global.exception.ErrorCode;
import org.springframework.http.HttpStatus;

/**
 * 커뮤니티 도메인의 에러 코드입니다.
 *
 * <p>상수 이름이 그대로 응답의 {@code code}가 되므로, 다른 도메인과 겹치지 않도록 이름에
 * {@code COMMUNITY_} 접두사를 붙입니다. {@link CommunityErrorCodeTest}가 이 규칙을 강제합니다.
 */
public enum CommunityErrorCode implements ErrorCode {

    COMMUNITY_LOGIN_REQUIRED(HttpStatus.UNAUTHORIZED, "로그인이 필요합니다."),
    COMMUNITY_POST_NOT_FOUND(HttpStatus.NOT_FOUND, "게시글을 찾을 수 없습니다."),
    COMMUNITY_POST_NOT_OWNED(HttpStatus.FORBIDDEN, "본인이 쓴 글만 고치거나 지울 수 있습니다."),
    COMMUNITY_CATEGORY_NOT_FOUND(HttpStatus.NOT_FOUND, "게시글 분류를 찾을 수 없습니다."),
    COMMUNITY_PERFUME_NOT_FOUND(HttpStatus.NOT_FOUND, "글에 걸 향수를 찾을 수 없습니다."),
    COMMUNITY_POST_INVALID(HttpStatus.BAD_REQUEST, "게시글 요청을 확인해주세요."),
    COMMUNITY_COMMENT_NOT_FOUND(HttpStatus.NOT_FOUND, "댓글을 찾을 수 없습니다."),
    COMMUNITY_COMMENT_NOT_OWNED(HttpStatus.FORBIDDEN, "본인이 쓴 댓글만 고치거나 지울 수 있습니다."),
    COMMUNITY_COLLECTION_NOT_FOUND(HttpStatus.NOT_FOUND, "첨부할 컬렉션을 찾을 수 없습니다."),
    COMMUNITY_PERFUMES_FROM_COLLECTION(HttpStatus.BAD_REQUEST,
            "컬렉션을 붙인 글의 향수는 컬렉션에서 가져옵니다. 향수를 따로 보낼 수 없습니다.");

    private final HttpStatus status;
    private final String message;

    CommunityErrorCode(HttpStatus status, String message) {
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
