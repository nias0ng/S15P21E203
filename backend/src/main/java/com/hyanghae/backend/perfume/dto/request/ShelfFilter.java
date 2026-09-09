package com.hyanghae.backend.perfume.dto.request;

/**
 * 로그인한 사용자 기준으로 향수를 걸러내는 조건입니다.
 *
 * <p>향수 자체의 속성이 아니라 "나와 이 향수의 관계"라서 로그인이 필요합니다. 비로그인 요청에
 * 이 값이 오면 401 입니다.
 *
 * <p>값은 프론트엔드의 {@code ShelfFilter} 를 그대로 따랐습니다. 진열대 도메인의
 * {@code ShelfCategory} 에는 {@code TRIED} 도 있지만 검색 필터에는 없습니다.
 */
public enum ShelfFilter {

    /** 진열대에 보유 중으로 담아 둔 향수입니다. */
    OWNED,

    /** 진열대에 위시로 담아 둔 향수입니다. */
    WISH,

    /** 상세 화면을 열어 본 적이 있는 향수입니다. 진열대와 무관합니다. */
    VIEWED;

    /** 진열대 조회에 쓰는 {@code user_perfumes.ownership_status} 값입니다. */
    public String ownershipStatus() {
        return name();
    }
}
