package com.hyanghae.backend.map.dto.response;

/**
 * 지도에 점으로 찍히는 향수 하나입니다.
 *
 * <p>{@code scentRegionId} 는 향수의 대표 향 계열입니다. 향수 하나가 계열 1~3개에 걸쳐 있고, 그중
 * 비중이 가장 큰 계열을 대표로 씁니다. 대표를 따로 저장해 두지 않는 이유는 값을 두 군데 두면 적재가
 * 한쪽만 갱신했을 때 조용히 어긋나기 때문입니다. 계열이 하나도 없는 향수는 {@code null} 입니다.
 *
 * <p>{@code imageUrl} 을 목록에 함께 담는 이유가 있습니다. 화면은 배와 가까운 향수 몇 개만 그리는데,
 * 배가 움직일 때마다 그 몇 개가 바뀝니다. 이미지 주소를 선택 시점에 따로 불러오면 배를 조금 움직일
 * 때마다 요청이 여러 개 나갑니다. 주소는 문자열이라 목록에 얹어도 크기가 작고, 실제 이미지 파일은
 * 브라우저가 화면에 그리는 것만 내려받습니다. 이미지가 없는 향수는 {@code null} 입니다.
 */
public record MapPerfumeResponse(
        Long perfumeId,
        String name,
        String imageUrl,
        double x,
        double y,
        Long scentRegionId
) {
}
