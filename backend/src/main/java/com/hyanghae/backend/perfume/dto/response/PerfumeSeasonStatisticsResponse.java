package com.hyanghae.backend.perfume.dto.response;

import java.util.List;

/**
 * 향수 계절 통계 응답입니다.
 *
 * <p>후기가 한 건도 없거나 아무도 계절을 고르지 않은 향수도 모든 계절을 {@code count} 0,
 * {@code percentage} 0 으로 내려줍니다. 화면이 계절 네 칸을 항상 그리기 때문에, 데이터가 있는 계절만
 * 주면 빈 칸을 화면이 채워야 합니다.
 */
public record PerfumeSeasonStatisticsResponse(List<PerfumeSeasonStatisticResponse> seasons) {
}
