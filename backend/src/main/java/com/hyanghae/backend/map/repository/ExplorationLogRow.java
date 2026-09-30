package com.hyanghae.backend.map.repository;

import java.time.OffsetDateTime;

/**
 * 탐색 기록 한 줄입니다. 향해 일지를 만들 때 씁니다.
 *
 * <p>빈 바다로 간 이동은 {@code perfumeId} 와 {@code perfumeName} 이 비어 있습니다. 그 줄은
 * 일지에 향수로 나오지 않고, 구역이 바뀌었다는 사실만 알려줍니다.
 *
 * <p>{@code perfumeNameKo} 는 향수가 있어도 비어 있을 수 있습니다. 한국어 이름이 아직 없는
 * 향수입니다.
 */
public record ExplorationLogRow(
        Long logId,
        Long perfumeId,
        String perfumeName,
        String perfumeNameKo,
        double x,
        double y,
        OffsetDateTime visitedAt
) {
}
