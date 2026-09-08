package com.hyanghae.backend.perfume;

/**
 * 향수 검색 결과 한 건입니다. 기능 명세의 "향수명, 브랜드명, 대표 이미지" 에 대응합니다.
 *
 * <p>{@code thumbnailUrl} 은 검색 쿼리에서 함께 조회하지 않고 나중에 채웁니다.
 * 한 향수에 이미지가 여러 장 있어 한 쿼리로 묶으면 행이 중복되기 때문입니다.
 * 그래서 JPQL 생성자 표현식은 3개 인자 생성자를 쓰고, 서비스가
 * {@link #withThumbnailUrl(String)} 로 대표 이미지를 채웁니다.
 *
 * <p>프론트엔드의 {@code PerfumeSummary} 는 {@code scentFamily} 도 기대하지만 기능 명세의
 * 검색 결과 구성에는 없습니다. {@code perfume_map_points}+{@code scent_regions} 조인이 필요하며
 * 향 지도 기능 이슈에서 다룹니다.
 */
public record PerfumeSummaryResponse(
        Long perfumeId,
        String name,
        String brand,
        String thumbnailUrl
) {

    /** JPQL 생성자 표현식이 사용합니다. 대표 이미지는 이후에 채웁니다. */
    public PerfumeSummaryResponse(Long perfumeId, String name, String brand) {
        this(perfumeId, name, brand, null);
    }

    public PerfumeSummaryResponse withThumbnailUrl(String thumbnailUrl) {
        return new PerfumeSummaryResponse(perfumeId, name, brand, thumbnailUrl);
    }
}
