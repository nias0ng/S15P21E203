package com.hyanghae.backend.perfume.dto.response;

import java.util.List;

/**
 * 관련 게시글 조회 응답입니다.
 *
 * <p>주변 향수와 달리 진짜 페이징입니다. 명세에 {@code page} 와 {@code totalElements} 가 있어
 * 나머지를 이어서 볼 수 있습니다.
 *
 * <p>{@code totalPages} 는 넣지 않았습니다. 명세에 없고, {@code totalElements} 와 {@code size} 로
 * 화면에서 계산할 수 있습니다. 검색 응답과 같은 판단입니다.
 */
public record PerfumePostsResponse(
        List<PerfumePostResponse> posts,
        int page,
        int size,
        long totalElements
) {
}
