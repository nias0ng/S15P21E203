package com.hyanghae.backend.community.dto.response;

import java.time.OffsetDateTime;
import java.util.List;

/**
 * 게시글 상세입니다. 로그인하지 않아도 볼 수 있습니다.
 *
 * <p>{@code nickname} 이 비어 있을 수 있습니다. 회원이 탈퇴하면 글은 남고 작성자만 지워집니다.
 *
 * <p>{@code images} 와 {@code perfumes} 는 글에 걸어 둔 순서 그대로입니다.
 *
 * <p>명세에 있던 {@code status}·{@code holdReason} 은 없습니다. 게시글 보류 기능이 없어지면서
 * 두 컬럼이 V5 에서 삭제됐습니다. 글은 있거나 지워졌거나 둘 중 하나입니다.
 */
public record PostDetailResponse(
        Long postId,
        PostCategoryResponse category,
        String nickname,
        String title,
        String content,
        List<String> images,
        List<PostPerfumeResponse> perfumes,
        OffsetDateTime createdAt,
        OffsetDateTime updatedAt
) {
}
