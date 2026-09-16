package com.hyanghae.backend.review.dto.response;

/**
 * 후기가 매달린 향수입니다.
 *
 * <p>후기 게시판은 여러 향수의 후기가 섞여 나오므로 줄마다 어느 향수 이야기인지 보여야 합니다.
 * 와이어프레임 A22a 가 "향수 블록이 없는 후기는 없다" 고 적어 둔 자리입니다.
 *
 * <p>{@code brand} 는 비어 있을 수 있습니다. 브랜드가 없는 향수가 있습니다.
 */
public record ReviewPerfumeResponse(Long perfumeId, String name, String brand) {
}
