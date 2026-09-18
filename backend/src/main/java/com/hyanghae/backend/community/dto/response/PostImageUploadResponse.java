package com.hyanghae.backend.community.dto.response;

import io.swagger.v3.oas.annotations.media.Schema;

/**
 * 방금 올린 이미지의 주소입니다. 화면은 이 값을 그대로 미리보기에 쓰고, 글을 저장할 때
 * {@code imageUrls} 에 담아 보냅니다.
 *
 * <p>주소가 상대 경로인 이유는 환경마다 도메인이 다르기 때문입니다. 절대 주소를 돌려주면
 * 로컬에서 올린 이미지의 주소가 {@code localhost} 로 데이터베이스에 저장되고, 그 글은 배포
 * 환경에서 이미지가 깨집니다.
 */
public record PostImageUploadResponse(
        @Schema(description = "이미지 주소. 글을 저장할 때 imageUrls 에 그대로 담아 보냅니다.",
                example = "/api/v1/posts/images/2026/09/0a1b2c3d-4e5f-6071-8293-a4b5c6d7e8f9.jpg")
        String imageUrl
) {
}
