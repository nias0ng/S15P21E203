package com.hyanghae.backend.map.dto.response;

/** 한 번의 구역 진입 동안 배가 들른 향수입니다. */
public record VisitedPerfumeResponse(Long perfumeId, String name) {
}
