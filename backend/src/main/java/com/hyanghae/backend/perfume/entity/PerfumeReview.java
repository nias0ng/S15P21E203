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
 * <p>{@code status} 는 매핑해 두었지만 아직 통계에서 걸러내지 않습니다. 후기 작성 기능이 없어
 * 이 컬럼에 어떤 값이 들어가는지 정해지지 않았습니다. 보류된 후기를 통계에서 빼는 것이 맞지만,
 * 값을 추측해 조건을 넣으면 실제 값이 다를 때 조용히 틀린 통계가 나옵니다.
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

    @Column(name = "status", length = 30)
    private String status;

    protected PerfumeReview() {
        // JPA 가 요구하는 기본 생성자입니다.
    }
}
