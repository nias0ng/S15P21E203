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
 * {@code perfume_reviews} 테이블 매핑입니다.
 *
 * <p>통계에 필요한 컬럼만 매핑했습니다. 후기 본문·작성자·작성 시각은 후기 목록 기능에서 씁니다.
 *
 * <p>{@code status} 컬럼은 일부러 매핑하지 않습니다. 보류와 비공개 개념이 모두 없어지면서
 * 컬럼 자체가 사라질 예정입니다. 매핑해 두면 컬럼이 사라지는 순간
 * {@code ddl-auto: validate} 가 실패해 애플리케이션이 아예 뜨지 않습니다.
 */
@Entity
@Table(name = "perfume_reviews")
public class PerfumeReview {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id")
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "perfume_id")
    private Perfume perfume;

    protected PerfumeReview() {
        // JPA 가 요구하는 기본 생성자입니다.
    }
}
