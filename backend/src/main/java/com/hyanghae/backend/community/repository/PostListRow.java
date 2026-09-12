package com.hyanghae.backend.community.repository;

import java.time.OffsetDateTime;

/**
 * 목록 한 줄입니다.
 *
 * <p>대표 향수는 여기 없습니다. 한 번에 모아 읽는 편이 빨라서 별도 조회로 가져오고, 서비스가
 * 둘을 합쳐 응답을 만듭니다.
 */
public record PostListRow(
        Long postId,
        String category,
        String title,
        String nickname,
        OffsetDateTime createdAt
) {
}
