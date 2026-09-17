package com.hyanghae.backend.perfume.dto.response;

/**
 * 향수 검색 결과 한 건입니다.
 *
 * <p>{@code imageUrl} 과 {@code scentFamily} 는 검색 쿼리에서 함께 조회하지 않고 나중에 채웁니다.
 * 이미지는 한 향수에 여러 장이라 한 쿼리로 묶으면 행이 중복되고, 향 계열은 향 지도 도메인의
 * 테이블에 있어 향수 조회와 같은 쿼리로 묶을 수 없습니다. 그래서 JPQL 생성자 표현식은 5개 인자
 * 생성자를 쓰고, 서비스가 {@link #with(String, String)} 로 나머지를 채웁니다.
 *
 * <p>둘 다 {@code null} 일 수 있습니다. 이미지가 없는 향수, 향 지도에 자리가 잡히지 않은 향수가
 * 있습니다.
 *
 * <p>브랜드 이름이 둘입니다. 카드가 <b>한국어를 크게, 영문을 작게</b> 그리기 때문입니다
 * (와이어프레임 A33). {@code brandNameKo} 는 비어 있을 수 있고, 그때 화면은 영문으로
 * 대신합니다 — 한국어 이름이 아직 없는 브랜드가 있고, 영문 표기만 다른 중복 브랜드는
 * 한쪽만 한국어 이름을 갖습니다.
 */
public record PerfumeSummaryResponse(
        Long perfumeId,
        String name,
        String nameKo,
        String brandName,
        String brandNameKo,
        String imageUrl,
        String scentFamily
) {

    /** JPQL 생성자 표현식이 사용합니다. 대표 이미지와 향 계열은 이후에 채웁니다. */
    public PerfumeSummaryResponse(
            Long perfumeId, String name, String nameKo, String brandName, String brandNameKo) {
        this(perfumeId, name, nameKo, brandName, brandNameKo, null, null);
    }

    public PerfumeSummaryResponse with(String imageUrl, String scentFamily) {
        return new PerfumeSummaryResponse(
                perfumeId, name, nameKo, brandName, brandNameKo, imageUrl, scentFamily);
    }
}
