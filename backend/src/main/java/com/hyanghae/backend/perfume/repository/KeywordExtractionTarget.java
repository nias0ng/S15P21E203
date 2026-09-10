package com.hyanghae.backend.perfume.repository;

/**
 * 키워드를 뽑아야 하는 후기가 남아 있는 향수입니다.
 *
 * @param perfumeId    처리 대상 향수입니다.
 * @param reviewCount  향수에 달린 전체 후기 수입니다. 최소 개수 정책의 기준이고, 실행 로그에서
 *                     규모를 가늠하는 데 씁니다.
 * @param pendingCount 아직 키워드를 뽑지 않은 후기 수입니다. 한 번에 보낼 수 있는 수보다 많으면
 *                     남은 것은 다음 실행이 이어서 처리합니다.
 */
public record KeywordExtractionTarget(Long perfumeId, long reviewCount, long pendingCount) {
}
