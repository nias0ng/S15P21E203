package com.hyanghae.backend.user.exception;

import com.hyanghae.backend.global.exception.ErrorCode;
import org.springframework.http.HttpStatus;

/**
 * 회원 도메인의 에러 코드입니다.
 *
 * <p>상수 이름이 그대로 응답의 {@code code} 가 되므로, 다른 도메인과 겹치지 않도록 이름에
 * {@code USER_} 접두사를 붙입니다. {@link UserErrorCodeTest} 가 이 규칙을 강제합니다.
 *
 * <p><b>닉네임·비밀번호 오류는 아직 {@code AuthErrorCode} 에 있습니다.</b> 이 도메인이 처음부터
 * 그것을 빌려 써 왔고, 이미 화면이 그 코드로 분기하고 있어 지금 옮기면 프론트엔드가 함께
 * 바뀌어야 합니다. 새로 만드는 것만 규칙대로 여기 둡니다. 옮기는 것은 별도 작업입니다.
 */
public enum UserErrorCode implements ErrorCode {

    USER_PROFILE_IMAGE_EMPTY(HttpStatus.BAD_REQUEST, "올릴 이미지를 선택해주세요."),
    // 제한 값을 문구에 적지 않습니다. 설정으로 바꿀 수 있는 값이라 여기 적으면 설정만 바꿨을 때
    // 안내가 거짓말이 됩니다. 실제 기본값은 Swagger 설명에 적혀 있습니다.
    USER_PROFILE_IMAGE_TOO_LARGE(HttpStatus.PAYLOAD_TOO_LARGE, "이미지 크기 제한을 넘었습니다."),
    USER_PROFILE_IMAGE_TYPE_NOT_ALLOWED(HttpStatus.UNSUPPORTED_MEDIA_TYPE,
            "JPG · PNG · GIF · WEBP 이미지만 올릴 수 있습니다."),
    USER_PROFILE_IMAGE_SAVE_FAILED(HttpStatus.INTERNAL_SERVER_ERROR, "이미지를 저장하지 못했습니다.");

    private final HttpStatus status;
    private final String message;

    UserErrorCode(HttpStatus status, String message) {
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
