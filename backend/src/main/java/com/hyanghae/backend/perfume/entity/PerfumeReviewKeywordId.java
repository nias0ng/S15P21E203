package com.hyanghae.backend.perfume.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;
import java.io.Serializable;
import java.util.Objects;

/** {@code perfume_review_keywords} 의 복합 기본키입니다. 후기 하나에서 키워드가 여러 개 나옵니다. */
@Embeddable
public class PerfumeReviewKeywordId implements Serializable {

    @Column(name = "review_id")
    private Long reviewId;

    @Column(name = "keyword_id")
    private Long keywordId;

    protected PerfumeReviewKeywordId() {
        // JPA 가 요구하는 기본 생성자입니다.
    }

    public PerfumeReviewKeywordId(Long reviewId, Long keywordId) {
        this.reviewId = reviewId;
        this.keywordId = keywordId;
    }

    @Override
    public boolean equals(Object other) {
        if (this == other) {
            return true;
        }
        if (!(other instanceof PerfumeReviewKeywordId that)) {
            return false;
        }
        return Objects.equals(reviewId, that.reviewId) && Objects.equals(keywordId, that.keywordId);
    }

    @Override
    public int hashCode() {
        return Objects.hash(reviewId, keywordId);
    }
}
