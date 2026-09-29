package com.hyanghae.backend.auth.exception;

import com.hyanghae.backend.global.exception.ErrorCode;
import org.springframework.http.HttpStatus;

public enum AuthErrorCode implements ErrorCode {

    AUTH_EMAIL_ALREADY_EXISTS(HttpStatus.CONFLICT, "이미 사용 중인 이메일입니다."),
    AUTH_NICKNAME_ALREADY_EXISTS(HttpStatus.CONFLICT, "이미 사용 중인 닉네임입니다."),
    AUTH_SIGNUP_CONFLICT(HttpStatus.CONFLICT, "이미 사용 중인 회원 정보입니다."),
    AUTH_INVALID_CREDENTIALS(HttpStatus.UNAUTHORIZED, "이메일 또는 비밀번호가 올바르지 않습니다."),
    AUTH_LOGIN_REQUIRED(HttpStatus.UNAUTHORIZED, "로그인이 필요합니다."),
    AUTH_INVALID_REFRESH_TOKEN(HttpStatus.UNAUTHORIZED, "Refresh Token이 유효하지 않습니다."),
    AUTH_ACCESS_DENIED(HttpStatus.FORBIDDEN, "요청한 작업을 수행할 권한이 없습니다."),
    AUTH_USER_NOT_FOUND(HttpStatus.NOT_FOUND, "사용자를 찾을 수 없습니다."),
    AUTH_CURRENT_PASSWORD_MISMATCH(HttpStatus.BAD_REQUEST, "현재 비밀번호가 올바르지 않습니다."),
    AUTH_INVALID_NICKNAME(HttpStatus.BAD_REQUEST, "닉네임은 공백을 제외하고 2자부터 20자까지 입력해야 합니다."),
    AUTH_INVALID_EMAIL(HttpStatus.BAD_REQUEST, "이메일 형식이 올바르지 않습니다."),
    AUTH_EMAIL_NOT_VERIFIED(HttpStatus.BAD_REQUEST, "이메일 인증이 필요합니다."),
    AUTH_EMAIL_VERIFICATION_CODE_MISMATCH(HttpStatus.BAD_REQUEST, "인증번호가 올바르지 않습니다."),
    AUTH_EMAIL_VERIFICATION_EXPIRED(HttpStatus.BAD_REQUEST, "인증번호가 만료되었습니다. 인증번호를 다시 받아 주세요."),
    AUTH_EMAIL_VERIFICATION_TOO_MANY_ATTEMPTS(
            HttpStatus.TOO_MANY_REQUESTS, "인증번호를 여러 번 틀렸습니다. 인증번호를 다시 받아 주세요."),
    AUTH_EMAIL_VERIFICATION_RESEND_TOO_SOON(
            HttpStatus.TOO_MANY_REQUESTS, "인증번호를 다시 받으려면 잠시 기다려 주세요."),
    AUTH_EMAIL_VERIFICATION_SEND_LIMIT_EXCEEDED(
            HttpStatus.TOO_MANY_REQUESTS, "인증번호 요청 횟수를 넘었습니다. 잠시 후 다시 시도해 주세요."),
    AUTH_EMAIL_SEND_FAILED(HttpStatus.SERVICE_UNAVAILABLE, "인증 메일을 보내지 못했습니다. 잠시 후 다시 시도해 주세요."),
    AUTH_PASSWORD_NOT_SET(HttpStatus.BAD_REQUEST, "비밀번호를 설정하지 않은 계정입니다."),
    AUTH_INVALID_GOOGLE_TOKEN(HttpStatus.UNAUTHORIZED, "Google 인증 정보가 유효하지 않습니다."),
    AUTH_GOOGLE_EMAIL_NOT_VERIFIED(HttpStatus.BAD_REQUEST, "이메일 인증을 마친 Google 계정만 쓸 수 있습니다."),
    AUTH_GOOGLE_ACCOUNT_MISMATCH(HttpStatus.BAD_REQUEST, "가입할 때 쓴 Google 계정으로 확인해 주세요."),
    AUTH_GOOGLE_REAUTH_REQUIRED(HttpStatus.BAD_REQUEST, "탈퇴하려면 Google 계정으로 한 번 더 확인해 주세요."),
    AUTH_GOOGLE_LOGIN_FAILED(HttpStatus.UNAUTHORIZED, "Google 로그인을 마치지 못했습니다. 처음부터 다시 해 주세요."),
    AUTH_GOOGLE_LOGIN_CANCELLED(HttpStatus.BAD_REQUEST, "Google 로그인을 취소했습니다."),
    AUTH_EMAIL_REGISTERED_WITH_PASSWORD(HttpStatus.CONFLICT, "이미 이메일로 가입된 계정입니다. 이메일과 비밀번호로 로그인해 주세요."),
    AUTH_INVALID_GOOGLE_SIGNUP_TICKET(HttpStatus.UNAUTHORIZED, "가입 시간이 지났습니다. Google 로그인부터 다시 해 주세요."),
    AUTH_GOOGLE_LOGIN_UNAVAILABLE(HttpStatus.SERVICE_UNAVAILABLE, "지금은 Google 로그인을 쓸 수 없습니다.");

    private final HttpStatus status;
    private final String message;

    AuthErrorCode(HttpStatus status, String message) {
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
