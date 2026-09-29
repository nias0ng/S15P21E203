package com.hyanghae.backend.auth.dto.response;

import io.swagger.v3.oas.annotations.media.Schema;

public record GoogleAuthorizationResponse(
        @Schema(description = "브라우저를 이동시킬 Google 로그인 화면 주소")
        String authorizationUrl
) {
}
