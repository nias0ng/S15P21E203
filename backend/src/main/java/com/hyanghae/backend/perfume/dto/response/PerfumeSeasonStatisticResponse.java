package com.hyanghae.backend.perfume.dto.response;

import java.math.BigDecimal;

/**
 * 계절 하나의 후기 통계입니다.
 *
 * <p>{@code ratio} 는 0 이상 1 이하입니다. 이름이 {@code percentage} 가 아니라 {@code ratio} 라서
 * 백분율이 아닌 비율로 내려줍니다. 화면에서 백분율로 보여주려면 100 을 곱하면 됩니다.
 *
 * <p>분모는 계절을 하나라도 고른 후기 수입니다. 후기 하나가 계절을 여러 개 고를 수 있어
 * 계절별 {@code ratio} 의 합이 1 을 넘을 수 있습니다.
 */
public record PerfumeSeasonStatisticResponse(
        Long seasonId,
        String code,
        String name,
        long count,
        BigDecimal ratio
) {
}
