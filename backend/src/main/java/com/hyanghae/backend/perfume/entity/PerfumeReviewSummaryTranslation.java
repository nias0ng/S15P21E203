package com.hyanghae.backend.perfume.entity;

import jakarta.persistence.Column;
import jakarta.persistence.EmbeddedId;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import java.time.Instant;

/**
 * {@code perfume_review_summary_translations} 테이블 매핑입니다. 한국어 AI 후기 요약을 다른 언어로
 * 옮긴 것을 보관합니다.
 *
 * <p>쓰기는 저장소의 {@code ON CONFLICT} 문장이 합니다. 같은 요약을 두 요청이 동시에 번역하면
 * 확인하고 넣는 방식으로는 한쪽이 기본키 충돌로 실패하기 때문입니다. 그래서 상태를 바꾸는
 * 메서드가 없습니다. {@code created_at} 은 표의 기본값이 채우므로 매핑하지 않습니다.
 *
 * <p>{@code source_updated_at} 은 번역할 때 쓴 한국어 요약의 갱신 시각입니다. 한국어 요약이 다시
 * 만들어지면 이 값과 달라지고, 그때 다시 번역합니다.
 */
@Entity
@Table(name = "perfume_review_summary_translations")
public class PerfumeReviewSummaryTranslation {

    @EmbeddedId
    private PerfumeReviewSummaryTranslationId id;

    @Column(name = "summary_text", columnDefinition = "text")
    private String summaryText;

    @Column(name = "source_updated_at")
    private Instant sourceUpdatedAt;

    protected PerfumeReviewSummaryTranslation() {
        // JPA 가 요구하는 기본 생성자입니다.
    }
}
