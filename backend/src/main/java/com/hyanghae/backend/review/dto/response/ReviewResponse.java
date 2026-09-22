package com.hyanghae.backend.review.dto.response;

import io.swagger.v3.oas.annotations.media.Schema;
import java.time.Instant;
import java.util.List;

/**
 * 향수 상세 안에 한 줄로 나오는 후기입니다.
 *
 * <p>{@code nickname} 과 {@code profileImageUrl} 은 작성자가 탈퇴하면 함께 비어 나갑니다. 후기는
 * 남고 작성자만 지워집니다({@code perfume_reviews.user_id} 가 {@code ON DELETE SET NULL} 입니다).
 *
 * <p>{@code profileImageUrl} 의 값 규칙은 {@code UserResponse} 와 같습니다. 사진을 설정하지
 * 않았으면 {@code null} 이고 화면이 기본 아바타를 보여줍니다.
 */
public record ReviewResponse(
        Long reviewId,
        String nickname,

        @Schema(description = "작성자 프로필 사진 주소. 설정하지 않았거나 탈퇴한 작성자면 null",
                nullable = true,
                example = "/api/v1/users/profile-images/2026/09/0a1b2c3d-4e5f-6071-8293-a4b5c6d7e8f9.jpg")
        String profileImageUrl,

        String title,
        String content,
        List<ReviewSeasonResponse> seasons,
        boolean mine,
        Instant createdAt,
        Instant updatedAt
) {
}
