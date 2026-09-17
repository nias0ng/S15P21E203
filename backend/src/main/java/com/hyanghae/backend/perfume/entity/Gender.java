package com.hyanghae.backend.perfume.entity;

/**
 * {@code perfumes.gender} 에 들어가는 값입니다.
 *
 * <p>컬럼은 {@code VARCHAR(30)} 이고 데이터베이스 제약이 없습니다. 어휘를 여기서 고정하는 이유는
 * 두 가지입니다. 검색 필터에 오타가 오면 조용히 0건이 아니라 400 이 나가고, 수집 데이터가 어떤
 * 값을 넣어야 하는지가 코드에 남습니다.
 *
 * <p>값은 프론트엔드의 {@code GenderFilter} 를 그대로 따랐습니다. 아직 확정된 어휘가 아니므로
 * 바뀌면 여기와 수집 파이프라인을 함께 고쳐야 합니다. 한쪽만 고치면 필터가 항상 0건이 됩니다.
 */
public enum Gender {
    FEMALE,
    MALE,
    UNISEX
}
