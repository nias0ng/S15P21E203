package com.hyanghae.backend.perfume.dto.response;

/**
 * 향수 기본 정보입니다. 기능 명세의 "브랜드명, 제품명, 대표 이미지 등 향수를 식별하는 데 필요한
 * 기본 정보" 에 대응합니다.
 *
 * <p>향조·후기·후기 통계·계절별 평가는 포함하지 않습니다. 명세가 "각각의 별도 기능에서 제공한다" 로
 * 명시하고 있습니다.
 *
 * <p>{@code thumbnailUrl} 은 조회 쿼리에서 함께 가져오지 않고 나중에 채웁니다. 한 향수에 이미지가
 * 여러 장 있어 한 쿼리로 묶으면 행이 중복되기 때문입니다. 검색 응답과 같은 방식입니다.
 */
public record PerfumeDetailResponse(
        Long perfumeId,
        String name,
        String brand,
        String thumbnailUrl,
        String description
) {

    /** JPQL 생성자 표현식이 사용합니다. 대표 이미지는 이후에 채웁니다. */
    public PerfumeDetailResponse(Long perfumeId, String name, String brand, String description) {
        this(perfumeId, name, brand, null, description);
    }

    public PerfumeDetailResponse withThumbnailUrl(String thumbnailUrl) {
        return new PerfumeDetailResponse(perfumeId, name, brand, thumbnailUrl, description);
    }
}
