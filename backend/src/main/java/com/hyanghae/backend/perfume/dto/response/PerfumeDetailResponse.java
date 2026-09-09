package com.hyanghae.backend.perfume.dto.response;

import java.util.List;

/**
 * 향수 기본 정보입니다.
 *
 * <p>향조·후기·후기 통계·계절별 평가는 포함하지 않습니다. 기능 명세가 "각각의 별도 기능에서
 * 제공한다" 로 명시하고 있습니다.
 *
 * <p>{@code images} 와 {@code prices} 는 조회 쿼리에서 함께 가져오지 않고 나중에 채웁니다.
 * 한 향수에 이미지와 가격이 여러 건이면 한 쿼리로 묶었을 때 향수 행이 그 곱만큼 중복됩니다.
 * 그래서 JPQL 생성자 표현식은 둘을 뺀 생성자를 쓰고, 서비스가
 * {@link #withImagesAndPrices(List, List)} 로 채웁니다.
 */
public record PerfumeDetailResponse(
        Long perfumeId,
        BrandResponse brand,
        String name,
        String nameKo,
        String gender,
        String description,
        String concentration,
        List<String> images,
        List<PerfumePriceResponse> prices
) {

    /**
     * JPQL 생성자 표현식이 사용합니다. 생성자 표현식으로는 중첩 객체를 만들 수 없어 브랜드를
     * 두 인자로 받아 여기서 조립합니다. 브랜드가 없는 향수는 {@code brand} 가 {@code null} 입니다.
     */
    public PerfumeDetailResponse(
            Long perfumeId,
            Long brandId,
            String brandName,
            String name,
            String nameKo,
            String gender,
            String description,
            String concentration
    ) {
        this(
                perfumeId,
                brandId == null ? null : new BrandResponse(brandId, brandName),
                name,
                nameKo,
                gender,
                description,
                concentration,
                List.of(),
                List.of()
        );
    }

    public PerfumeDetailResponse withImagesAndPrices(
            List<String> images,
            List<PerfumePriceResponse> prices
    ) {
        return new PerfumeDetailResponse(
                perfumeId, brand, name, nameKo, gender, description, concentration, images, prices
        );
    }
}
