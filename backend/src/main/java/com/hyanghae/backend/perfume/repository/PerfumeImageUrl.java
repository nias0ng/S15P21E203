package com.hyanghae.backend.perfume.repository;

/**
 * 향수 이미지 조회 결과입니다. 향수 한 건에 여러 행이 나올 수 있고, 대표 이미지가 먼저 옵니다.
 * 검색은 첫 행만 쓰고 기본 정보 조회는 전체를 씁니다.
 */
public record PerfumeImageUrl(Long perfumeId, String imageUrl) {
}
