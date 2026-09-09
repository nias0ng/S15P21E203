package com.hyanghae.backend.perfume.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;
import java.io.Serializable;
import java.util.Objects;

/** {@code perfume_accords} 의 복합 기본키입니다. {@link PerfumeNoteId} 와 같은 이유로 필요합니다. */
@Embeddable
public class PerfumeAccordId implements Serializable {

    @Column(name = "perfume_id")
    private Long perfumeId;

    @Column(name = "accord_id")
    private Long accordId;

    protected PerfumeAccordId() {
        // JPA 가 요구하는 기본 생성자입니다.
    }

    @Override
    public boolean equals(Object other) {
        if (this == other) {
            return true;
        }
        if (!(other instanceof PerfumeAccordId that)) {
            return false;
        }
        return Objects.equals(perfumeId, that.perfumeId) && Objects.equals(accordId, that.accordId);
    }

    @Override
    public int hashCode() {
        return Objects.hash(perfumeId, accordId);
    }
}
