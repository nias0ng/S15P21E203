package com.hyanghae.backend.recommendation.repository;

import java.time.OffsetDateTime;

/** 사용자별 후보 계산 결과가 어떤 입력까지 반영했는지 나타냅니다. */
public record PersonalizedRecommendationCacheState(
        long sourceVersion,
        Long calculatedSourceVersion,
        long lastViewId,
        OffsetDateTime calculatedAt,
        String resultStatus
) {

    public boolean isEmptyResult() {
        return "EMPTY".equals(resultStatus);
    }

    public boolean isReadyResult() {
        return "READY".equals(resultStatus);
    }
}
