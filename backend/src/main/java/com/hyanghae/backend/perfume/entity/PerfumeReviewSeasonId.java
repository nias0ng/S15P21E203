package com.hyanghae.backend.perfume.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;
import java.io.Serializable;
import java.util.Objects;

/** {@code perfume_review_seasons} 의 복합 기본키입니다. */
@Embeddable
public class PerfumeReviewSeasonId implements Serializable {

    @Column(name = "review_id")
    private Long reviewId;

    @Column(name = "season_id")
    private Long seasonId;

    protected PerfumeReviewSeasonId() {
        // JPA 가 요구하는 기본 생성자입니다.
    }

    @Override
    public boolean equals(Object other) {
        if (this == other) {
            return true;
        }
        if (!(other instanceof PerfumeReviewSeasonId that)) {
            return false;
        }
        return Objects.equals(reviewId, that.reviewId) && Objects.equals(seasonId, that.seasonId);
    }

    @Override
    public int hashCode() {
        return Objects.hash(reviewId, seasonId);
    }
}
