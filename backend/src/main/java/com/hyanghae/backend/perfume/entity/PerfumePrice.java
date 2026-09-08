package com.hyanghae.backend.perfume.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import java.math.BigDecimal;
import java.time.Instant;

/**
 * {@code perfume_prices} 테이블 매핑입니다.
 *
 * <p>같은 향수가 용량별로 여러 행을 가집니다. 가격은 판매처와 시점에 따라 흩어지므로 단일 값이
 * 아니라 최저·최고를 함께 보관합니다.
 */
@Entity
@Table(name = "perfume_prices")
public class PerfumePrice {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "price_id")
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "perfume_id")
    private Perfume perfume;

    @Column(name = "min_price", precision = 12, scale = 2)
    private BigDecimal minPrice;

    @Column(name = "max_price", precision = 12, scale = 2)
    private BigDecimal maxPrice;

    @Column(name = "volume_ml", precision = 6, scale = 2)
    private BigDecimal volumeMl;

    @Column(name = "collected_at")
    private Instant collectedAt;

    protected PerfumePrice() {
        // JPA 가 요구하는 기본 생성자입니다.
    }
}
