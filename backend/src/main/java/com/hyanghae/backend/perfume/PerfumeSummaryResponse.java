package com.hyanghae.backend.perfume;

/**
 * 향수 검색 결과 한 건입니다.
 *
 * <p>프론트엔드의 {@code PerfumeSummary}(features/perfume/types.ts)는 {@code thumbnailUrl} 과
 * {@code scentFamily} 도 기대하지만, 기능 명세의 검색 범위가 향수명·브랜드명이므로 이번에는 제외했습니다.
 * 두 필드는 각각 {@code perfume_images}, {@code perfume_map_points}+{@code scent_regions} 조인이
 * 필요하며 해당 기능 이슈에서 추가합니다.
 */
public record PerfumeSummaryResponse(Long perfumeId, String name, String brand) {
}
