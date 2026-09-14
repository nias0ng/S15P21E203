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

/**
 * {@code perfumes} 테이블 매핑입니다.
 *
 * <p>검색과 기본 정보 조회에 필요한 컬럼을 매핑했습니다. JPA 는 테이블의 모든 컬럼을 매핑하도록
 * 요구하지 않으므로, 쓰이는 곳이 생길 때 필드를 추가합니다.
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

    @Column(name = "gender", length = 30)
    private String gender;

    @Column(name = "description", length = 500)
    private String description;

    @Column(name = "concentration", length = 30)
    private String concentration;

    @Column(name = "is_active", nullable = false)
    private boolean active;

    protected Perfume() {
        // JPA 가 요구하는 기본 생성자입니다.
    }

    public Long getId() {
        return id;
    }
}
