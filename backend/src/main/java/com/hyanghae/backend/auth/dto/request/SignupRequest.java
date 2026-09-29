package com.hyanghae.backend.auth.dto.request;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.util.Locale;

public record SignupRequest(
        @Schema(description = "로그인 이메일", example = "sailor@example.com")
        @NotBlank
        @Email
        @Size(max = 255)
        String email,

        @Schema(description = "비밀번호, 8~64자", format = "password")
        @NotBlank
        @Size(min = 8, max = 64)
        String password,

        @Schema(description = "닉네임, 공백을 제외하고 2~20자", example = "향해자")
        @NotBlank
        @Size(min = 2, max = 20)
        String nickname,

        @Schema(description = "이메일 인증 확인 응답의 verificationToken")
        @NotBlank
        @Size(max = 128)
        String emailVerificationToken
) {

    public SignupRequest {
        if (email != null) {
            email = email.trim().toLowerCase(Locale.ROOT);
        }
        if (nickname != null) {
            nickname = nickname.trim();
        }
    }
}
