package com.hyanghae.backend.perfume.dto.response;

/**
 * 향수 후기 통계입니다.
 *
 * <p>보류된 후기를 제외하지 않습니다. 후기 작성 기능이 없어 {@code perfume_reviews.status} 의
 * 값 어휘가 정해지지 않았습니다. 상태가 정의되면 {@code PerfumeReviewRepository} 의 조건 한 곳만
 * 고치면 됩니다.
 */
public record PerfumeReviewStatisticsResponse(long reviewCount) {
}
