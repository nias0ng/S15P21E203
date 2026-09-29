package com.hyanghae.backend.auth.dto.response;

import io.swagger.v3.oas.annotations.media.Schema;

public record EmailVerificationResponse(
        @Schema(description = "보낸 인증번호의 유효 시간(초)", example = "300")
        long expiresInSeconds,

        @Schema(description = "인증번호를 다시 받을 수 있을 때까지 남은 시간(초)", example = "60")
        long resendAvailableInSeconds
) {
}
