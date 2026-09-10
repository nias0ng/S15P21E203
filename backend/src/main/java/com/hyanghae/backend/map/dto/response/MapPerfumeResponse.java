package com.hyanghae.backend.map.dto.response;

/**
 * 지도에 점으로 찍히는 향수 하나입니다.
 *
 * <p>{@code scentRegionId} 는 향수의 대표 향 계열입니다. 향수 하나가 계열 1~3개에 걸쳐 있고, 그중
 * 비중이 가장 큰 계열을 대표로 씁니다. 대표를 따로 저장해 두지 않는 이유는 값을 두 군데 두면 적재가
 * 한쪽만 갱신했을 때 조용히 어긋나기 때문입니다. 계열이 하나도 없는 향수는 {@code null} 입니다.
 */
public record MapPerfumeResponse(
        Long perfumeId,
        String name,
        double x,
        double y,
        Long scentRegionId
) {
}
