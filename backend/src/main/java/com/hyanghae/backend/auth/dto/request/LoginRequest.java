package com.hyanghae.backend.auth.dto.request;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.util.Locale;

public record LoginRequest(
        @Schema(description = "로그인 이메일", example = "sailor@example.com")
        @NotBlank
        @Email
        @Size(max = 255)
        String email,

        @Schema(description = "비밀번호", format = "password")
        @NotBlank
        @Size(max = 64)
        String password
) {

    public LoginRequest {
        if (email != null) {
            email = email.trim().toLowerCase(Locale.ROOT);
        }
    }
}
