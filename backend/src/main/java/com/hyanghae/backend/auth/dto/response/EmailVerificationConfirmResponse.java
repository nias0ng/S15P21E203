package com.hyanghae.backend.auth.dto.response;

import io.swagger.v3.oas.annotations.media.Schema;

public record EmailVerificationConfirmResponse(
        @Schema(description = "회원가입 요청의 emailVerificationToken 에 넣는 값")
        String verificationToken,

        @Schema(description = "인증 토큰의 유효 시간(초)", example = "1800")
        long expiresInSeconds
) {
}
