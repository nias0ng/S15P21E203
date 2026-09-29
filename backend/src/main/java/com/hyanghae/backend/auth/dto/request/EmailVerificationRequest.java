package com.hyanghae.backend.auth.dto.request;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.util.Locale;

public record EmailVerificationRequest(
        @Schema(description = "인증번호를 받을 이메일, 가입할 이메일과 같아야 합니다", example = "sailor@example.com")
        @NotBlank
        @Email
        @Size(max = 255)
        String email
) {

    public EmailVerificationRequest {
        if (email != null) {
            email = email.trim().toLowerCase(Locale.ROOT);
        }
    }
}
