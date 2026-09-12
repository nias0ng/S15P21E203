package com.hyanghae.backend.community.dto.response;

import java.time.OffsetDateTime;

/**
 * 목록에 한 줄로 나오는 글입니다.
 *
 * <p>{@code nickname} 이 비어 있을 수 있습니다. 회원이 탈퇴하면 글은 남고 작성자만 지워집니다
 * ({@code posts.user_id} 가 {@code ON DELETE SET NULL} 입니다).
 */
public record PostSummaryResponse(
        Long postId,
        String title,
        String nickname,
        OffsetDateTime createdAt
) {
}
