package com.hyanghae.backend.community.dto.response;

import java.time.OffsetDateTime;

/** 방금 쓴 댓글입니다. 화면은 이 번호로 수정·삭제를 겁니다. */
public record CommentCreateResponse(Long commentId, OffsetDateTime createdAt) {
}
