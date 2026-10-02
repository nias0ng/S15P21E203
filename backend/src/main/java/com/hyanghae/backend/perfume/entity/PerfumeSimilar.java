package com.hyanghae.backend.perfume.entity;

import jakarta.persistence.Column;
import jakarta.persistence.EmbeddedId;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import java.math.BigDecimal;

/**
 * {@code perfume_similars} 테이블 매핑입니다. 향 지도 밖 향수의 '비슷한 향수' 를 담습니다.
 *
 * <p>{@link PerfumeNeighbor} 와 하는 일이 같지만 표를 나눴습니다. 지도 200개의 이웃은 3D 지도가
 * 그리는 선과 같은 목록이어야 해서, 13만 개를 후보로 다시 계산한 목록으로 덮을 수 없습니다.
 * 계산은 {@code ai/build_similars.py} 가 하고 백엔드는 읽기만 합니다.
 */
@Entity
@Table(name = "perfume_similars")
public class PerfumeSimilar {

    @EmbeddedId
    private PerfumeSimilarId id;

    @Column(name = "similarity", nullable = false)
    private BigDecimal similarity;

    @Column(name = "rank", nullable = false)
    private Short rank;

    protected PerfumeSimilar() {
        // JPA 가 요구하는 기본 생성자입니다.
    }
}
