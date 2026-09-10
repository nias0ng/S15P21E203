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
 * <p>기본키를 애플리케이션이 정하므로 {@code save} 만으로는 갱신인지 신규인지 구분되지 않습니다.
 * 그래서 생성은 {@link #of}, 갱신은 {@link #update} 로 나눠 두었습니다. 배치가 기존 행을 읽어
 * {@code update} 를 호출하면 {@code created_at} 이 처음 생성 시각으로 남습니다. 새 인스턴스를
 * 만들어 덮어쓰면 {@code created_at} 이 매번 갱신 시각으로 바뀌어, 요약이 언제부터 있었는지
 * 알 수 없게 됩니다.
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

    @Column(name = "created_at")
    private Instant createdAt;

    @Column(name = "updated_at")
    private Instant updatedAt;

    protected PerfumeReviewSummary() {
        // JPA 가 요구하는 기본 생성자입니다.
    }

    private PerfumeReviewSummary(
            Long perfumeId,
            String summaryText,
            int sourceReviewCount,
            Instant generatedAt
    ) {
        this.perfumeId = perfumeId;
        this.summaryText = summaryText;
        this.sourceReviewCount = sourceReviewCount;
        this.createdAt = generatedAt;
        this.updatedAt = generatedAt;
    }

    /** 향수의 첫 요약입니다. {@code created_at} 과 {@code updated_at} 이 같습니다. */
    public static PerfumeReviewSummary of(
            Long perfumeId,
            String summaryText,
            int sourceReviewCount,
            Instant generatedAt
    ) {
        return new PerfumeReviewSummary(perfumeId, summaryText, sourceReviewCount, generatedAt);
    }

    /** 요약을 다시 생성했을 때 본문과 기준 후기 수를 바꿉니다. {@code created_at} 은 그대로입니다. */
    public void update(String summaryText, int sourceReviewCount, Instant generatedAt) {
        this.summaryText = summaryText;
        this.sourceReviewCount = sourceReviewCount;
        this.updatedAt = generatedAt;
    }
}
