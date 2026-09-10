package com.hyanghae.backend.perfume.entity;

import jakarta.persistence.EmbeddedId;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;

/**
 * {@code perfume_review_keywords} 테이블 매핑입니다. 후기와 거기서 뽑힌 키워드를 잇습니다.
 *
 * <p>{@code perfume_review_seasons} 와 같은 구조입니다. 후기 하나에 여러 키워드가 붙을 수 있어
 * 키워드별 백분율의 합이 100 을 넘을 수 있습니다.
 */
@Entity
@Table(name = "perfume_review_keywords")
public class PerfumeReviewKeyword {

    @EmbeddedId
    private PerfumeReviewKeywordId id;

    protected PerfumeReviewKeyword() {
        // JPA 가 요구하는 기본 생성자입니다.
    }
}
