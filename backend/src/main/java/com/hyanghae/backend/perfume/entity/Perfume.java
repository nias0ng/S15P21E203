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
import java.time.LocalDate;

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

    /**
     * Fragrantica 원본 향수 번호입니다. {@code uk_perfumes_fragrantica_id} 로 유일합니다.
     *
     * <p>자연어 추천이 이 값을 씁니다. AI 서버는 우리 DB 를 모르고 자기 데이터의 원본 번호로
     * 향수를 지목하므로, 그 번호를 {@code perfume_id} 로 바꾸는 일이 백엔드 몫입니다.
     *
     * <p>{@code NULL} 일 수 있습니다. 적재 스크립트가 짝지어 주지 못한 향수가 남습니다.
     * {@code NULL} 은 무엇과도 같지 않으므로 이 값으로 찾는 쿼리에는 걸리지 않습니다.
     */
    @Column(name = "fragrantica_id")
    private Long fragranticaId;

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

    /**
     * 확인된 생산 상태입니다. {@code DISCONTINUED} 이면 추천에서 빠지고 상세에 '단종' 으로 적힙니다.
     *
     * <p>{@link #active} 와 다릅니다. 단종 향수도 검색 · 상세 · 진열대 · 후기는 그대로입니다 — 이미
     * 가진 사람이 있습니다. {@code NULL} 은 '모름' 이지 판매 중이 아닙니다.
     */
    @Column(name = "production_status", length = 20)
    private String productionStatus;

    @Column(name = "production_status_checked_at")
    private LocalDate productionStatusCheckedAt;

    @Column(name = "production_status_source", length = 500)
    private String productionStatusSource;

    protected Perfume() {
        // JPA 가 요구하는 기본 생성자입니다.
    }

    public Long getId() {
        return id;
    }
}
