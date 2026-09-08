package com.hyanghae.backend.perfume;

import com.hyanghae.backend.brand.Brand;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;

/**
 * {@code perfumes} 테이블 매핑입니다.
 *
 * <p>검색과 기본 정보 조회에 필요한 컬럼만 매핑했습니다. {@code gender}, {@code concentration} 은
 * 아직 쓰이는 곳이 없어 매핑하지 않았습니다. JPA 는 테이블의 모든 컬럼을 매핑하도록 요구하지 않습니다.
 *
 * <p>{@code brand_id} 는 nullable 이므로 브랜드가 없는 향수가 존재할 수 있습니다. 검색 쿼리가
 * {@code LEFT JOIN} 을 쓰는 이유입니다.
 */
@Entity
@Table(name = "perfumes")
public class Perfume {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "perfume_id")
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "brand_id")
    private Brand brand;

    @Column(name = "name")
    private String name;

    @Column(name = "name_ko")
    private String nameKo;

    @Column(name = "description", length = 500)
    private String description;

    @Column(name = "is_active", nullable = false)
    private boolean active;

    protected Perfume() {
        // JPA 가 요구하는 기본 생성자입니다.
    }
}
