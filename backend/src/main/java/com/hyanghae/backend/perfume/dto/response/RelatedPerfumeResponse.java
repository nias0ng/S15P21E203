package com.hyanghae.backend.perfume.dto.response;

/**
 * 어떤 향수와 이어져 있는 다른 향수 한 건입니다. 주변 향수와 유사 향수가 함께 씁니다.
 *
 * <p>주변 향수는 {@code perfume_neighbors}, 유사 향수는 거기에 더해 지도 밖 향수에
 * {@code perfume_similars} 를 읽습니다. 표는 달라도 응답 형태가 같아 어느 한쪽 이름을 붙이지
 * 않았습니다.
 *
 * <p>검색 결과({@link PerfumeSummaryResponse})와 달리 {@code brandName} 이 없습니다. 두 API 의
 * 명세 응답에 브랜드명이 없어서입니다. 화면에 브랜드가 필요하면 명세부터 고쳐야 합니다.
 *
 * <p>{@code imageUrl} 은 조회 쿼리에서 함께 가져오지 않고 나중에 채웁니다. 한 향수에 이미지가
 * 여러 장이면 조인 결과의 행이 중복되기 때문입니다. 검색·기본 정보 조회와 같은 방식입니다.
 */
public record RelatedPerfumeResponse(
        Long perfumeId,
        String name,
        String nameKo,
        String imageUrl
) {

    /** JPQL 생성자 표현식이 사용합니다. 대표 이미지는 이후에 채웁니다. */
    public RelatedPerfumeResponse(Long perfumeId, String name, String nameKo) {
        this(perfumeId, name, nameKo, null);
    }

    public RelatedPerfumeResponse withImageUrl(String imageUrl) {
        return new RelatedPerfumeResponse(perfumeId, name, nameKo, imageUrl);
    }
}
