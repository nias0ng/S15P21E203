package com.hyanghae.backend.recommendation.repository;

import java.time.OffsetDateTime;

/** 취향 점수 상위 후보 한 건입니다. */
public record PersonalizedRecommendationCandidate(
        Long perfumeId,
        String name,
        String imageUrl,
        double score,
        String evidenceSource,
        String evidenceName,
        OffsetDateTime lastRecommendedAt
) {
}
