package com.hyanghae.backend.perfume.dto.response;

import java.time.Instant;

/**
 * 향수에 연결된 게시글 한 건입니다.
 *
 * <p>{@code createdAt} 은 {@code NULL} 일 수 있습니다. {@code posts.created_at} 에 NOT NULL 제약이
 * 없습니다. 게시글 작성 기능이 생기면 항상 채워지겠지만, 지금 단정하면 조용히 깨집니다.
 */
public record PerfumePostResponse(Long postId, String title, Instant createdAt) {
}
