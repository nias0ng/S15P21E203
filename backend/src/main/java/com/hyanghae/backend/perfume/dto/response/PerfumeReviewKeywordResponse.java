package com.hyanghae.backend.perfume.dto.response;

import java.math.BigDecimal;

/**
 * 후기에서 자주 나온 향 표현 하나입니다.
 *
 * <p>{@code percentage} 는 0 이상 100 이하이고, 이 키워드가 나온 후기의 비중입니다. 분모는
 * 키워드가 하나라도 뽑힌 후기 수입니다. 후기 하나에서 키워드가 여러 개 나올 수 있어 합이 100 을
 * 넘을 수 있습니다.
 *
 * <p>계절 통계와 같이 소수점 한 자리까지 줍니다.
 */
public record PerfumeReviewKeywordResponse(String keyword, BigDecimal percentage) {
}
