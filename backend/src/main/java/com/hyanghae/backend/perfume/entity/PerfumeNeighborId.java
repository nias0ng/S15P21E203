package com.hyanghae.backend.perfume.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;
import java.io.Serializable;
import java.util.Objects;

/**
 * {@code perfume_neighbors} 의 복합 기본키입니다.
 *
 * <p>두 컬럼 모두 {@code perfumes} 를 가리킵니다. 앞이 기준 향수, 뒤가 그 향수의 이웃입니다.
 * 방향이 있으므로 A 의 이웃 목록에 B 가 있다고 해서 B 의 이웃 목록에 A 가 있다는 보장은 없습니다.
 */
@Embeddable
public class PerfumeNeighborId implements Serializable {

    @Column(name = "perfume_id")
    private Long perfumeId;

    @Column(name = "neighbor_perfume_id")
    private Long neighborPerfumeId;

    protected PerfumeNeighborId() {
        // JPA 가 요구하는 기본 생성자입니다.
    }

    @Override
    public boolean equals(Object other) {
        if (this == other) {
            return true;
        }
        if (!(other instanceof PerfumeNeighborId that)) {
            return false;
        }
        return Objects.equals(perfumeId, that.perfumeId)
                && Objects.equals(neighborPerfumeId, that.neighborPerfumeId);
    }

    @Override
    public int hashCode() {
        return Objects.hash(perfumeId, neighborPerfumeId);
    }
}
