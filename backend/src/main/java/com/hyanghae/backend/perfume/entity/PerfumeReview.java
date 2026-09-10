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
import java.time.Instant;

/**
 * {@code perfume_reviews} 테이블 매핑입니다.
 *
 * <p>통계와 AI 요약에 필요한 컬럼을 매핑했습니다. 작성자는 아직 매핑하지 않습니다. 후기 목록
 * 기능이 쓸 때 추가하면 됩니다.
 *
 * <p>{@code title} 과 {@code content} 는 후기 요약 배치가 씁니다. AI 에게 보낼 원문이 있어야
 * 하는데, 매핑이 없으면 JPQL 에서 이 컬럼을 지목할 수 없습니다.
 *
 * <p>{@code created_at} 도 같은 배치가 씁니다. 후기가 많은 향수는 전부 보내지 않고 최근 것부터
 * 자르는데, 자를 기준이 필요합니다.
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

    @Column(name = "title", length = 100)
    private String title;

    @Column(name = "content", columnDefinition = "text")
    private String content;

    @Column(name = "created_at")
    private Instant createdAt;

    protected PerfumeReview() {
        // JPA 가 요구하는 기본 생성자입니다.
    }
}
