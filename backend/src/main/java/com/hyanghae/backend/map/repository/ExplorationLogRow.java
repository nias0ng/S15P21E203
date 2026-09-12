package com.hyanghae.backend.map.repository;

import java.time.OffsetDateTime;

/**
 * 탐색 기록 한 줄입니다. 향해 일지를 만들 때 씁니다.
 *
 * <p>빈 바다로 간 이동은 {@code perfumeId} 와 {@code perfumeName} 이 비어 있습니다. 그 줄은
 * 일지에 향수로 나오지 않고, 구역이 바뀌었다는 사실만 알려줍니다.
 */
public record ExplorationLogRow(
        Long logId,
        Long perfumeId,
        String perfumeName,
        double x,
        double y,
        OffsetDateTime visitedAt
) {
}
