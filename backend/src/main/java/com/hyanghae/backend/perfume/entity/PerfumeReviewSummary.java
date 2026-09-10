package com.hyanghae.backend.perfume.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;

/**
 * {@code perfume_review_summaries} 테이블 매핑입니다. AI 가 생성한 후기 요약을 보관합니다.
 *
 * <p>향수당 한 건이라 {@code perfume_id} 가 그대로 기본키입니다. 대리키를 두지 않았으므로
 * 향수 하나에 요약이 여러 개 생길 수 없습니다.
 *
 * <p>{@code source_review_count} 는 요약을 만들 때 사용한 후기 수입니다. 현재 후기 수와 비교하면
 * 요약을 다시 생성할 시점인지 판단할 수 있습니다.
 *
 * <p>지금 이 표를 채우는 코드는 없습니다. 화면이 상위 키워드 몇 개로 요약 문장을 구성하기로
 * 정해져, 배치는 키워드만 적재합니다. 조회 API 는 남아 있어 값이 있으면 그대로 내려줍니다.
 */
@Entity
@Table(name = "perfume_review_summaries")
public class PerfumeReviewSummary {

    @Id
    @Column(name = "perfume_id")
    private Long perfumeId;

    @Column(name = "summary_text", columnDefinition = "text")
    private String summaryText;

    @Column(name = "source_review_count")
    private Integer sourceReviewCount;

    @Column(name = "updated_at")
    private Instant updatedAt;

    protected PerfumeReviewSummary() {
        // JPA 가 요구하는 기본 생성자입니다.
    }
}
