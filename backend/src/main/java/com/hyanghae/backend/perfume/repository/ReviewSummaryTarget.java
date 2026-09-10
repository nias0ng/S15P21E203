package com.hyanghae.backend.perfume.repository;

/**
 * 후기 요약을 새로 만들어야 하는 향수입니다.
 *
 * <p>{@code reviewCount} 는 향수에 달린 전체 후기 수입니다. 요약을 적재할 때
 * {@code source_review_count} 로 그대로 들어가므로, 후기 통계 API 가 세는 수와 기준이 같아야
 * 합니다. 기준이 어긋나면 "요약 이후 새로 쌓인 후기 수"가 실제와 달라져 재생성 시점이 밀립니다.
 */
public record ReviewSummaryTarget(Long perfumeId, long reviewCount) {
}
