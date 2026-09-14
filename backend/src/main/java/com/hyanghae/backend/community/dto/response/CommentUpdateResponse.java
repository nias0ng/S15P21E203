package com.hyanghae.backend.community.dto.response;

import java.time.OffsetDateTime;

/** 방금 고친 댓글입니다. 화면은 이 시각으로 "(수정됨)" 표시를 다시 그립니다. */
public record CommentUpdateResponse(Long commentId, OffsetDateTime updatedAt) {
}
