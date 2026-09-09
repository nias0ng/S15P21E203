package com.hyanghae.backend.perfume.dto.response;

import java.math.BigDecimal;
import java.time.Instant;

/**
 * 향수 가격 한 건입니다. 같은 향수가 용량별로 여러 건을 가집니다.
 *
 * <p>{@code collectedAt} 을 함께 내리는 이유는, 가격이 수집 시점의 값이라 화면에서 언제 기준인지
 * 알려줘야 하기 때문입니다.
 */
public record PerfumePriceResponse(
        BigDecimal volumeMl,
        BigDecimal minPrice,
        BigDecimal maxPrice,
        Instant collectedAt
) {
}
