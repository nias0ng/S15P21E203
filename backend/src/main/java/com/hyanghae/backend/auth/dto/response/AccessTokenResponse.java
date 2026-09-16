package com.hyanghae.backend.auth.dto.response;

import io.swagger.v3.oas.annotations.media.Schema;

public record AccessTokenResponse(
        @Schema(description = "API 요청에 사용할 Access Token")
        String accessToken
) {
}
