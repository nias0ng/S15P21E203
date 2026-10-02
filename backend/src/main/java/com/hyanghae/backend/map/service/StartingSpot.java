package com.hyanghae.backend.map.service;

import com.hyanghae.backend.map.repository.ExplorationPoint;

/**
 * 출발점으로 삼으려는 향수의 자리와, 그 자리가 이름표 조각 안인 계열입니다.
 *
 * <p>{@code labelRegionCode} 는 비어 있을 수 있습니다. 떨어져 나온 작은 조각이나 계열 밖 바다에
 * 그려진 향수입니다({@link ScentRegions#labelRegionAt}).
 */
public record StartingSpot(ExplorationPoint point, String labelRegionCode) {

    /** 이 자리가 그 계열의 이름표 조각 안인지입니다. */
    public boolean isLabeledAs(String regionCode) {
        return regionCode.equals(labelRegionCode);
    }
}
