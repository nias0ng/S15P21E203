package com.hyanghae.backend.auth.dto.request;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.util.Locale;

public record EmailVerificationConfirmRequest(
        @Schema(description = "인증번호를 받은 이메일", example = "sailor@example.com")
        @NotBlank
        @Email
        @Size(max = 255)
        String email,

        @Schema(description = "메일로 받은 숫자 7자리 인증번호", pattern = "^\\d{7}$")
        @NotBlank
        @Pattern(regexp = "^\\d{7}$")
        String code
) {

    public EmailVerificationConfirmRequest {
        if (email != null) {
            email = email.trim().toLowerCase(Locale.ROOT);
        }
    }
}
