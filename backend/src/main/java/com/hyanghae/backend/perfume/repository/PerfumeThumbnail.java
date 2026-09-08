package com.hyanghae.backend.perfume.repository;

/** 대표 이미지 조회 결과입니다. 향수 한 건에 여러 행이 나올 수 있습니다. */
public record PerfumeThumbnail(Long perfumeId, String imageUrl) {
}
