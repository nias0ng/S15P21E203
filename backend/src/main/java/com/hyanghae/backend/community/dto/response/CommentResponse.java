package com.hyanghae.backend.community.dto.response;

import java.time.OffsetDateTime;

/**
 * 댓글 한 개입니다.
 *
 * <p>{@code nickname} 이 비어 있을 수 있습니다. 회원이 탈퇴하면 댓글은 남고 작성자만 지워집니다
 * ({@code comments.user_id} 가 {@code ON DELETE SET NULL} 입니다).
 *
 * <p>{@code updatedAt} 은 댓글을 만들 때 {@code createdAt} 과 같은 값으로 채웁니다. 두 값이
 * 다르면 고친 댓글이라는 뜻이고, 화면은 그것으로 "(수정됨)" 표시를 판단합니다. 만들 때 비워 두면
 * 화면이 "고친 적 없음" 을 따로 다뤄야 합니다.
 *
 * <p>{@code mine} 은 보는 사람마다 다릅니다. 수정·삭제 버튼을 띄울지 정하는 값이라 로그인한
 * 사용자에게만 참이 되고, 비로그인에게는 전부 거짓입니다. 버튼을 숨기는 것으로 권한이 지켜지지는
 * 않으므로 수정·삭제 API 가 작성자를 다시 확인합니다.
 */
public record CommentResponse(
        Long commentId,
        String nickname,
        String content,
        OffsetDateTime createdAt,
        OffsetDateTime updatedAt,
        boolean mine
) {
}
