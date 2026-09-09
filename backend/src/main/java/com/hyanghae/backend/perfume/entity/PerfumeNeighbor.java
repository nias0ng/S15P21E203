package com.hyanghae.backend.perfume.entity;

import jakarta.persistence.EmbeddedId;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;

/**
 * {@code perfume_neighbors} 테이블 매핑입니다. 향 지도에서 서로 가까운 향수 쌍을 담습니다.
 *
 * <p>API 명세가 "사전 계산된 주변 향수"라고 정한 대로, 백엔드는 거리를 계산하지 않고 미리 채워진
 * 행을 읽기만 합니다.
 *
 * <p>두 컬럼 말고 다른 컬럼이 없습니다. 즉 <b>이웃 사이의 순서를 정할 근거가 테이블에 없습니다.</b>
 * 가까운 순으로 보여주려면 {@code rank} 나 {@code distance} 컬럼이 필요합니다. 그때까지는
 * 조회 쿼리가 향수 id 순으로 순서를 고정합니다.
 */
@Entity
@Table(name = "perfume_neighbors")
public class PerfumeNeighbor {

    @EmbeddedId
    private PerfumeNeighborId id;

    protected PerfumeNeighbor() {
        // JPA 가 요구하는 기본 생성자입니다.
    }
}
