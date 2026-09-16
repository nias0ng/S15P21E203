package com.hyanghae.backend.user.dto.request;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record UserDeleteRequest(
        @Schema(description = "본인 확인용 비밀번호", format = "password")
        @NotBlank
        @Size(max = 64)
        String password
) {
}
