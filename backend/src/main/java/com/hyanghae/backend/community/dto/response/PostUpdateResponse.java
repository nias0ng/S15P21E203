package com.hyanghae.backend.community.dto.response;

import java.time.OffsetDateTime;

/** 방금 고친 글입니다. {@code updatedAt} 은 데이터베이스가 넣은 시각입니다. */
public record PostUpdateResponse(Long postId, OffsetDateTime updatedAt) {
}
