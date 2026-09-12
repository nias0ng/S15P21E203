package com.hyanghae.backend.community.repository;

import java.time.OffsetDateTime;

/** 방금 넣은 게시글의 번호와 작성 시각입니다. */
public record CreatedPost(Long postId, OffsetDateTime createdAt) {
}
