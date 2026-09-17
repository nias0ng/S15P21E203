package com.hyanghae.backend.user.dto.response;

import io.swagger.v3.oas.annotations.media.Schema;

/**
 * 방금 올린 프로필 사진의 주소입니다. 이미 계정에 적용된 뒤라 화면은 이 값으로 아바타만
 * 갈아 끼우면 됩니다. 내 정보를 다시 조회할 필요가 없습니다.
 *
 * <p>주소가 상대 경로인 이유는 환경마다 도메인이 다르기 때문입니다. 절대 주소를 돌려주면
 * 로컬에서 올린 사진의 주소가 {@code localhost} 로 저장되고, 배포 환경에서 깨집니다.
 */
public record UserProfileImageResponse(
        @Schema(description = "프로필 사진 주소",
                example = "/api/v1/users/profile-images/2026/09/0a1b2c3d-4e5f-6071-8293-a4b5c6d7e8f9.jpg")
        String profileImageUrl
) {
}
