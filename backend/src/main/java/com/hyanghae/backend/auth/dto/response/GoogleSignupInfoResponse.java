package com.hyanghae.backend.auth.dto.response;

import io.swagger.v3.oas.annotations.media.Schema;

public record GoogleSignupInfoResponse(
        @Schema(description = "가입할 Google 계정 이메일", example = "sailor@gmail.com")
        String email,

        @Schema(description = "Google 프로필 이름으로 만든 추천 닉네임. 쓸 만한 이름이 없으면 null."
                + " 이미 쓰이는 닉네임일 수 있습니다", nullable = true, example = "향해자")
        String suggestedNickname
) {
}
