package com.hyanghae.backend.community.repository;

import java.time.OffsetDateTime;

/**
 * 게시글 한 개입니다. 이미지와 향수는 따로 읽습니다.
 *
 * <p>{@code authorId} 는 응답에 그대로 나가지 않습니다. 두 가지에 씁니다. 고치거나 지울 수 있는
 * 사람인지 판단하는 데 쓰고, 상세의 {@code mine} 을 채우는 데 씁니다. 작성자가 탈퇴하면 비어
 * 있고, 그러면 아무도 그 글을 고칠 수 없습니다.
 *
 * <p>분류는 번호와 코드를 모두 들고 있습니다. 코드는 화면으로 나가고, 번호는 수정할 때 분류를
 * 그대로 두기 위해 필요합니다.
 */
public record PostRow(
        Long postId,
        Long authorId,
        Long categoryId,
        String categoryCode,
        String nickname,
        String title,
        String content,
        OffsetDateTime createdAt,
        OffsetDateTime updatedAt
) {
}
