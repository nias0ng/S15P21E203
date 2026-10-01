package com.hyanghae.backend.perfume.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;
import java.io.Serializable;
import java.util.Objects;

/** {@code perfume_review_summary_translations} 의 복합 기본키입니다. 향수 하나에 언어마다 한 건입니다. */
@Embeddable
public class PerfumeReviewSummaryTranslationId implements Serializable {

    @Column(name = "perfume_id")
    private Long perfumeId;

    @Column(name = "language", length = 8)
    private String language;

    protected PerfumeReviewSummaryTranslationId() {
        // JPA 가 요구하는 기본 생성자입니다.
    }

    @Override
    public boolean equals(Object other) {
        if (this == other) {
            return true;
        }
        if (!(other instanceof PerfumeReviewSummaryTranslationId that)) {
            return false;
        }
        return Objects.equals(perfumeId, that.perfumeId) && Objects.equals(language, that.language);
    }

    @Override
    public int hashCode() {
        return Objects.hash(perfumeId, language);
    }
}
