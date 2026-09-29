package com.hyanghae.backend.auth.dto.request;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record GoogleSignupRequest(
        @Schema(description = "닉네임, 공백을 제외하고 2~20자", example = "향해자")
        @NotBlank
        @Size(min = 2, max = 20)
        String nickname
) {

    public GoogleSignupRequest {
        if (nickname != null) {
            nickname = nickname.trim();
        }
    }
}
