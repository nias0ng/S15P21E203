package com.hyanghae.backend.user.dto.request;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record PasswordChangeRequest(
        @Schema(description = "현재 비밀번호", format = "password")
        @NotBlank
        @Size(max = 64)
        String currentPassword,

        @Schema(description = "새 비밀번호, 8~64자", format = "password")
        @NotBlank
        @Size(min = 8, max = 64)
        String newPassword
) {
}
