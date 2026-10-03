package com.hyanghae.backend.map.service;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;
import org.junit.jupiter.api.Test;

/**
 * 좌표가 어느 계열의 <b>이름표 조각</b> 안인지 가르는 규칙을 검증합니다.
 *
 * <p>고정 데이터는 조각이 둘인 머스크 하나입니다. 왼쪽 아래 정사각형이 이름표가 있는 조각이고,
 * 오른쪽 위 작은 정사각형이 떨어져 나온 조각입니다. 둘 사이는 바다입니다.
 */
class ScentRegionsTest {

    private static final ScentRegionRef MUSK = new ScentRegionRef(6L, "MUSK");

    private static final List<List<Double>> LABEL_PIECE =
            List.of(List.of(0.0, 0.0), List.of(0.4, 0.0), List.of(0.4, 0.4), List.of(0.0, 0.4));
    private static final List<List<Double>> DETACHED_PIECE =
            List.of(List.of(0.7, 0.7), List.of(0.8, 0.7), List.of(0.8, 0.8), List.of(0.7, 0.8));

    private final ScentRegions regions = new ScentRegions(List.of(
            new ScentRegions.Region(MUSK, 0.2, 0.2, List.of(LABEL_PIECE, DETACHED_PIECE))));

    @Test
    void answersTheRegionInsideTheLabelPiece() {
        assertThat(regions.labelRegionAt(0.1, 0.1)).contains(MUSK);
    }

    /**
     * 떨어져 나온 조각은 그 계열 영역이지만 이름표 조각은 아닙니다.
     *
     * <p>{@link ScentRegions#at} 은 향해 일지가 쓰는 판정이라 그대로 그 계열로 답합니다. 둘이 갈리는
     * 자리가 바로 이 조각입니다.
     */
    @Test
    void doesNotCountADetachedPiece() {
        assertThat(regions.at(0.75, 0.75)).contains(MUSK);
        assertThat(regions.labelRegionAt(0.75, 0.75)).isEmpty();
    }

    @Test
    void answersNothingInTheOpenSea() {
        assertThat(regions.labelRegionAt(0.55, 0.55)).isEmpty();
    }

    /** 이름표 자리가 적재되지 않았으면 어느 조각이 이름표 조각인지 알 수 없어 답하지 않습니다. */
    @Test
    void answersNothingWhenTheAnchorIsMissing() {
        ScentRegions withoutAnchor = new ScentRegions(List.of(
                new ScentRegions.Region(MUSK, null, null, List.of(LABEL_PIECE))));

        assertThat(withoutAnchor.at(0.1, 0.1)).contains(MUSK);
        assertThat(withoutAnchor.labelRegionAt(0.1, 0.1)).isEmpty();
    }

    /** 이름표 자리가 어느 조각에도 들지 않으면 이름표 조각이 없는 계열입니다. */
    @Test
    void answersNothingWhenTheAnchorIsOutsideEveryPiece() {
        ScentRegions strayAnchor = new ScentRegions(List.of(
                new ScentRegions.Region(MUSK, 0.55, 0.55, List.of(LABEL_PIECE, DETACHED_PIECE))));

        assertThat(strayAnchor.labelRegionAt(0.1, 0.1)).isEmpty();
        assertThat(strayAnchor.labelRegionAt(0.75, 0.75)).isEmpty();
    }
}
