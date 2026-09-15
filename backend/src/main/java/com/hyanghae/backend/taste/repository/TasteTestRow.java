package com.hyanghae.backend.taste.repository;

import java.time.OffsetDateTime;
import java.util.List;

/**
 * 저장된 취향 테스트 한 줄입니다.
 *
 * <p>{@code picks} 는 순위 순서입니다. 첫 번째가 1순위입니다.
 *
 * <p>{@code x}·{@code y} 는 결과 향수의 지도 좌표입니다. 결과 향수가 비었거나 지도에서 빠졌으면
 * 함께 비어 있습니다.
 */
public record TasteTestRow(
        List<String> picks,
        Long matchedPerfumeId,
        Double x,
        Double y,
        OffsetDateTime completedAt
) {
}
