package com.hyanghae.backend.perfume.dto.response;

import java.time.Instant;

/**
 * AI 가 생성한 후기 요약입니다.
 *
 * <p>요약이 아직 없는 향수는 세 필드가 모두 {@code null} 인 200 응답입니다. 404 를 쓰지 않는
 * 이유는 "향수가 없다" 와 구분되지 않기 때문입니다. 없는 향수는 {@code PERFUME_NOT_FOUND} 로
 * 404 를 반환합니다.
 *
 * <p>요약을 생성하는 파이프라인이 아직 없어 현재는 모든 향수가 빈 응답입니다.
 *
 * <p>{@code sourceReviewCount} 는 요약을 만들 때 사용한 후기 수입니다. 후기 통계의
 * {@code reviewCount} 와 비교하면 요약이 최신인지 화면에서 판단할 수 있습니다.
 */
public record PerfumeReviewSummaryResponse(
        String summary,
        Integer sourceReviewCount,
        Instant updatedAt
) {

    /** 요약이 없는 향수의 응답입니다. */
    public static PerfumeReviewSummaryResponse empty() {
        return new PerfumeReviewSummaryResponse(null, null, null);
    }
}
