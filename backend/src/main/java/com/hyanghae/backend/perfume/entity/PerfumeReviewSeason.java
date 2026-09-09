package com.hyanghae.backend.perfume.entity;

import jakarta.persistence.EmbeddedId;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;

/**
 * {@code perfume_review_seasons} 테이블 매핑입니다. 후기가 고른 계절을 잇습니다.
 *
 * <p>후기 하나가 계절을 여러 개 고를 수 있어, 계절별 비율의 합이 100%를 넘을 수 있습니다.
 */
@Entity
@Table(name = "perfume_review_seasons")
public class PerfumeReviewSeason {

    @EmbeddedId
    private PerfumeReviewSeasonId id;

    protected PerfumeReviewSeason() {
        // JPA 가 요구하는 기본 생성자입니다.
    }
}
