package com.hyanghae.backend.community.repository;

import com.hyanghae.backend.community.dto.response.PostCategoryResponse;
import java.time.OffsetDateTime;

/**
 * 게시글 한 줄입니다. 이미지와 향수는 따로 읽습니다.
 *
 * <p>{@code authorId} 는 응답에 나가지 않습니다. 고치거나 지울 수 있는 사람인지 판단하는 데만
 * 씁니다. 작성자가 탈퇴하면 비어 있고, 그러면 아무도 그 글을 고칠 수 없습니다.
 */
public record PostRow(
        Long postId,
        Long authorId,
        PostCategoryResponse category,
        String nickname,
        String title,
        String content,
        OffsetDateTime createdAt,
        OffsetDateTime updatedAt
) {
}
