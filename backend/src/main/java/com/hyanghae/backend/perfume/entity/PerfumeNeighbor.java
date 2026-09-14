package com.hyanghae.backend.perfume.entity;

import jakarta.persistence.Column;
import jakarta.persistence.EmbeddedId;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;

/**
 * {@code perfume_neighbors} 테이블 매핑입니다. 향 지도에서 서로 가까운 향수 쌍을 담습니다.
 *
 * <p>API 명세가 "사전 계산된 주변 향수"라고 정한 대로, 백엔드는 거리를 계산하지 않고 미리 채워진
 * 행을 읽기만 합니다.
 *
 * <p>{@code rank} 는 닮은 순서입니다. 적재 데이터가 향수마다 닮은 향수 10개를 순서대로 주므로
 * 그 순서를 그대로 담습니다. 순서가 없으면 {@code size} 로 자를 때 가장 닮은 향수가 잘려 나갑니다.
 */
@Entity
@Table(name = "perfume_neighbors")
public class PerfumeNeighbor {

    @EmbeddedId
    private PerfumeNeighborId id;

    @Column(name = "rank")
    private Integer rank;

    protected PerfumeNeighbor() {
        // JPA 가 요구하는 기본 생성자입니다.
    }
}
