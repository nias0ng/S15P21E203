package com.hyanghae.backend.perfume.dto.response;

/**
 * 향수 후기 통계입니다.
 *
 * <p>후기 수는 화면 표시값이면서 AI 후기 요약을 다시 만들 시점의 기준입니다. 요약이 들고 있는
 * {@code sourceReviewCount} 와의 차이가 요약 이후 새로 쌓인 후기 수입니다.
 */
public record PerfumeReviewStatisticsResponse(long reviewCount) {
}
