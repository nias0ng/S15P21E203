package com.hyanghae.backend.community.dto.response;

import java.time.OffsetDateTime;

/** 방금 쓴 글입니다. 화면은 이 번호로 상세 화면에 들어갑니다. */
public record PostCreateResponse(Long postId, OffsetDateTime createdAt) {
}
