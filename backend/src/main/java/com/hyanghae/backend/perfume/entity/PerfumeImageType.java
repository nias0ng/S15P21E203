package com.hyanghae.backend.perfume.entity;

/**
 * 향수 이미지가 사용되는 시각 표현 방식입니다.
 *
 * <p>향수 한 건에 두 장이 함께 있을 수 있습니다. 어느 쪽을 뽑을지는 <b>화면의 배경</b>이
 * 정합니다 — 종이 배경 위에는 종이 질감을, 그 밖에는 투명 배경의 일반 이미지를 씁니다.
 *
 * <p>고르는 일은 {@code PerfumeImageRepository.findOrderedByPerfumeIdsPreferring} 이 합니다.
 * 종류를 보지 않는 조회는 {@code display_order} 가 1번인 일반 이미지를 뽑습니다.
 */
public enum PerfumeImageType {

    /**
     * 투명 배경의 일반 이미지입니다. 검색 · 상세 · 지도 · 커뮤니티에서 씁니다.
     *
     * <p>모든 향수에 있습니다. 종이 질감이 없는 향수의 대체 이미지이기도 합니다.
     */
    ORIGINAL,

    /**
     * 종이 질감 이미지입니다. <b>진열대와 컬렉션</b>에서 씁니다 — 둘 다 종이 배경 화면입니다.
     *
     * <p>모든 향수에 있지는 않습니다. 없으면 {@link #ORIGINAL} 로 넘어갑니다.
     */
    PAPER_TEXTURE
}
