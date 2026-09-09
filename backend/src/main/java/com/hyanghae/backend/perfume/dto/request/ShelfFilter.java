package com.hyanghae.backend.perfume.dto.request;

/**
 * 사용자들이 담거나 열어 본 기록을 기준으로 향수를 걸러내는 조건입니다.
 *
 * <p><b>전체 사용자 집계입니다.</b> 값 이름이 개인 소유처럼 읽히지만 "내가 담은"이 아니라
 * "사람들이 담은"입니다. 그래서 로그인이 필요 없습니다.
 *
 * <p>값은 프론트엔드의 {@code ShelfFilter} 를 그대로 따랐습니다. 진열대 도메인의
 * {@code ShelfCategory} 에는 {@code TRIED} 도 있지만 검색 필터에는 없습니다.
 */
public enum ShelfFilter {

    /** 보유 중으로 담은 사람이 있는 향수입니다. */
    OWNED,

    /** 보유 희망으로 담은 사람이 있는 향수입니다. */
    WISH,

    /** 상세 화면을 열어 본 사람이 있는 향수입니다. 진열대와 무관합니다. */
    VIEWED;

    /** 진열대 조회에 쓰는 {@code user_perfumes.ownership_status} 값입니다. */
    public String ownershipStatus() {
        return name();
    }
}
