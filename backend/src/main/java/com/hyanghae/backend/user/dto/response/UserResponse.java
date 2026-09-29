package com.hyanghae.backend.user.dto.response;

import com.hyanghae.backend.user.entity.User;
import io.swagger.v3.oas.annotations.media.Schema;

/**
 * 내 정보입니다.
 *
 * <p>{@code profileImageUrl} 이 {@code null} 이면 프로필 사진을 설정하지 않은 상태입니다.
 * 화면이 기본 아바타를 보여줍니다. 서버가 기본 이미지 주소를 넣어 주지 않는 이유는, 기본
 * 이미지를 바꿀 때 이미 저장된 값을 전부 고쳐야 하기 때문입니다.
 */
public record UserResponse(
        Long userId,
        String email,
        String nickname,

        @Schema(description = "프로필 사진 주소. 설정하지 않았으면 null", nullable = true,
                example = "/api/v1/users/profile-images/2026/09/0a1b2c3d-4e5f-6071-8293-a4b5c6d7e8f9.jpg")
        String profileImageUrl,

        @Schema(description = "비밀번호가 있는 계정인지. Google 로 가입했으면 false 라서 비밀번호"
                + " 변경을 쓸 수 없고, 탈퇴할 때 Google 로 본인 확인을 합니다", example = "true")
        boolean hasPassword,

        @Schema(description = "Google 계정으로 로그인할 수 있는지", example = "false")
        boolean googleConnected
) {

    public static UserResponse from(User user) {
        return new UserResponse(
                user.getId(),
                user.getEmail(),
                user.getNickname(),
                user.getProfileImageUrl(),
                user.hasPassword(),
                user.getGoogleSubject() != null
        );
    }
}
