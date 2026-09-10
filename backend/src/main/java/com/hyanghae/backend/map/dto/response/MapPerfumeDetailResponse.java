package com.hyanghae.backend.map.dto.response;

/**
 * 지도에서 향수를 눌렀을 때 보여줄 요약입니다.
 *
 * <p>향수 상세({@code GET /api/v1/perfumes/{id}})와 다른 엔드포인트인 이유는 지도가 필요한 값이
 * 훨씬 적기 때문입니다. 브랜드·가격·향조까지 받아 오면 지도에서 점을 누를 때마다 쓰지 않는 값을
 * 함께 실어 보냅니다. 상세 화면으로 넘어가는 시점에 상세를 부릅니다.
 *
 * <p>{@code imageUrl} 은 대표 이미지 하나입니다. 이미지가 없는 향수는 {@code null} 입니다.
 */
public record MapPerfumeDetailResponse(
        Long perfumeId,
        String name,
        String nameKo,
        String imageUrl,
        double x,
        double y,
        Long scentRegionId
) {
}
