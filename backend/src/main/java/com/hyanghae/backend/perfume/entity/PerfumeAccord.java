package com.hyanghae.backend.perfume.entity;

import jakarta.persistence.Column;
import jakarta.persistence.EmbeddedId;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import java.math.BigDecimal;

/**
 * {@code perfume_accords} 테이블 매핑입니다. 향수와 어코드를 잇고 순위와 비중을 담습니다.
 *
 * <p>{@code rank} 는 어코드의 두드러진 정도 순서이고, {@code weight} 는 그 비중입니다.
 */
@Entity
@Table(name = "perfume_accords")
public class PerfumeAccord {

    @EmbeddedId
    private PerfumeAccordId id;

    @Column(name = "rank")
    private Integer rank;

    @Column(name = "weight", precision = 10, scale = 6)
    private BigDecimal weight;

    protected PerfumeAccord() {
        // JPA 가 요구하는 기본 생성자입니다.
    }
}
