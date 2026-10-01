package com.hyanghae.backend.perfume.repository;

import com.hyanghae.backend.perfume.entity.PerfumeReviewSummaryTranslation;
import com.hyanghae.backend.perfume.entity.PerfumeReviewSummaryTranslationId;
import java.time.Instant;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

/**
 * 후기 요약 번역을 읽고 씁니다.
 *
 * <p><b>쓰기는 네이티브 쿼리입니다.</b> 영어 화면이 같은 향수를 동시에 두 번 열면 두 요청이 모두
 * "번역 없음" 을 보고 둘 다 번역해 저장하려 합니다. 확인하고 넣는 방식이면 한쪽이 기본키 충돌로
 * 실패합니다. PostgreSQL 의 {@code ON CONFLICT DO UPDATE} 는 한 문장이라 그 틈이 없습니다.
 */
public interface PerfumeReviewSummaryTranslationRepository
        extends JpaRepository<PerfumeReviewSummaryTranslation, PerfumeReviewSummaryTranslationId> {

    /** 향수의 한 언어 번역을 읽습니다. 번역한 적이 없으면 빈 {@link Optional} 입니다. */
    @Query("""
            SELECT new com.hyanghae.backend.perfume.repository.ReviewSummaryTranslationRow(
                       t.summaryText, t.sourceUpdatedAt)
            FROM PerfumeReviewSummaryTranslation t
            WHERE t.id.perfumeId = :perfumeId AND t.id.language = :language
            """)
    Optional<ReviewSummaryTranslationRow> findRow(
            @Param("perfumeId") Long perfumeId,
            @Param("language") String language
    );

    /**
     * 번역을 넣거나, 이미 있으면 바꿉니다.
     *
     * <p>이미 있는 번역이 더 새 한국어 요약에서 나온 것이면 바꾸지 않습니다. 한국어 요약이 갱신되는
     * 사이에 옛 요약을 번역하던 요청이 늦게 끝나면, 새 번역을 옛 번역으로 되돌려 놓기 때문입니다.
     * 같은 시각이면 바꿉니다 — 같은 요약을 두 번 번역한 것이라 어느 쪽이 남아도 됩니다.
     *
     * @return 실제로 쓰인 행 수. 더 새 번역이 있어 건너뛰면 0
     */
    @Modifying
    @Query(value = """
            INSERT INTO perfume_review_summary_translations
                (perfume_id, language, summary_text, source_updated_at)
            VALUES (:perfumeId, :language, :summaryText, :sourceUpdatedAt)
            ON CONFLICT (perfume_id, language) DO UPDATE
            SET summary_text = EXCLUDED.summary_text,
                source_updated_at = EXCLUDED.source_updated_at
            WHERE perfume_review_summary_translations.source_updated_at
                  <= EXCLUDED.source_updated_at
            """, nativeQuery = true)
    int upsert(
            @Param("perfumeId") Long perfumeId,
            @Param("language") String language,
            @Param("summaryText") String summaryText,
            @Param("sourceUpdatedAt") Instant sourceUpdatedAt
    );
}
