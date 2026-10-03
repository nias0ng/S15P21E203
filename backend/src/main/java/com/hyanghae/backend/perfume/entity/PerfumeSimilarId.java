package com.hyanghae.backend.perfume.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;
import java.io.Serializable;
import java.util.Objects;

/**
 * {@code perfume_similars} 의 복합 기본키입니다.
 *
 * <p>앞이 기준 향수, 뒤가 그 향수와 닮은 향수입니다. {@link PerfumeNeighborId} 처럼 방향이
 * 있습니다.
 */
@Embeddable
public class PerfumeSimilarId implements Serializable {

    @Column(name = "perfume_id")
    private Long perfumeId;

    @Column(name = "similar_perfume_id")
    private Long similarPerfumeId;

    protected PerfumeSimilarId() {
        // JPA 가 요구하는 기본 생성자입니다.
    }

    @Override
    public boolean equals(Object other) {
        if (this == other) {
            return true;
        }
        if (!(other instanceof PerfumeSimilarId that)) {
            return false;
        }
        return Objects.equals(perfumeId, that.perfumeId)
                && Objects.equals(similarPerfumeId, that.similarPerfumeId);
    }

    @Override
    public int hashCode() {
        return Objects.hash(perfumeId, similarPerfumeId);
    }
}
