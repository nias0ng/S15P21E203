package com.hyanghae.backend.perfume.dto.response;

import java.math.BigDecimal;

/**
 * 계절 하나의 후기 통계입니다.
 *
 * <p>{@code percentage} 는 0 이상 100 이하입니다. 화면이 그대로 쓸 수 있도록 백분율로 내려줍니다.
 * 소수점 한 자리까지 줍니다. 3분의 1 을 정수로 반올림하면 33 이 되어 원래 값과 0.33 포인트가
 * 차이 나는데, 한 자리를 남기면 33.3 이 됩니다.
 *
 * <p>분모는 계절을 하나라도 고른 후기 수입니다. 후기 하나가 계절을 여러 개 고를 수 있어
 * 계절별 {@code percentage} 의 합이 100 을 넘을 수 있습니다.
 */
public record PerfumeSeasonStatisticResponse(
        Long seasonId,
        String code,
        String name,
        long count,
        BigDecimal percentage
) {
}
