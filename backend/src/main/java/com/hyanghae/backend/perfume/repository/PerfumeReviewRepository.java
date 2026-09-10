package com.hyanghae.backend.perfume.repository;

import com.hyanghae.backend.perfume.entity.PerfumeReview;
import java.time.Instant;
import java.util.Collection;
import java.util.List;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

/**
 * 후기 통계 조회와 키워드 추출 대상 조회입니다.
 *
 * <p>향수에 달린 후기를 전부 셉니다. 후기는 존재하거나 삭제되거나 둘 중 하나이고 그 사이
 * 상태가 없습니다. 보류와 비공개 개념이 모두 없어지면서 {@code perfume_reviews.status} 도
 * 사라질 예정이라, 앞으로도 걸러낼 후기가 생기지 않습니다.
 */
public interface PerfumeReviewRepository extends JpaRepository<PerfumeReview, Long> {

    /**
     * 향수의 후기 수입니다.
     *
     * <p>키워드 추출을 시작하는 최소 개수 정책의 기준이라, 배치가 대상을 고를 때 세는 수와
     * 같아야 합니다. 지금은 양쪽 다 향수에 달린 모든 후기입니다.
     *
     * <p>시향 기록({@code personal_records})은 세지 않습니다. 기능 명세서의 시스템 처리 항목에
     * 시향 기록을 함께 분석한다는 문장이 있으나, 팀이 후기만 쓰기로 정했습니다.
     */
    @Query("""
            SELECT COUNT(r)
            FROM PerfumeReview r
            WHERE r.perfume.id = :perfumeId
            """)
    long countByPerfumeId(@Param("perfumeId") Long perfumeId);

    /**
     * 계절을 하나라도 고른 후기 수입니다. 계절 백분율의 분모로 씁니다.
     *
     * <p>계절을 고르지 않은 후기까지 분모에 넣으면, 계절을 답한 사람들의 분포가 희석됩니다.
     *
     * <p>기능 명세서는 비율을 사용자 기준으로 정의합니다. 여기서 후기를 세는데도 같은 값이
     * 나오는 것은 review 도메인이 한 사용자가 한 향수에 후기를 하나만 갖도록 보장하기
     * 때문입니다. 이 전제가 깨지면 후기를 여러 개 쓴 사용자가 여러 표를 던지게 되므로,
     * {@code perfume_reviews} 에 {@code (user_id, perfume_id)} 유니크 제약이 필요합니다.
     */
    @Query("""
            SELECT COUNT(DISTINCT rs.id.reviewId)
            FROM PerfumeReviewSeason rs, PerfumeReview r
            WHERE rs.id.reviewId = r.id
              AND r.perfume.id = :perfumeId
            """)
    long countReviewsWithSeasonByPerfumeId(@Param("perfumeId") Long perfumeId);

    /**
     * 계절별 후기 수입니다. 후기가 고르지 않은 계절도 0 으로 포함합니다.
     *
     * <p>화면이 계절 네 칸을 항상 그리므로, 데이터가 있는 계절만 주면 빈 칸을 화면이 채워야 합니다.
     * 그래서 {@code Season} 을 기준으로 왼쪽 조인합니다.
     */
    @Query("""
            SELECT new com.hyanghae.backend.perfume.repository.SeasonCount(
                       s.id, s.code, s.name, COUNT(r.id))
            FROM Season s
            LEFT JOIN PerfumeReviewSeason rs ON rs.id.seasonId = s.id
            LEFT JOIN PerfumeReview r ON r.id = rs.id.reviewId AND r.perfume.id = :perfumeId
            GROUP BY s.id, s.code, s.name
            ORDER BY s.id
            """)
    List<SeasonCount> findSeasonCountsByPerfumeId(@Param("perfumeId") Long perfumeId);

    /**
     * 키워드를 뽑아야 하는 후기가 남아 있는 향수를 찾습니다.
     *
     * <p>조건은 두 가지입니다. 후기가 {@code minReviewCount} 개 이상이어야 하고, 아직 키워드를
     * 뽑지 않은 후기가 하나 이상 있어야 합니다.
     *
     * <p>최소 개수를 두는 이유는 화면 때문입니다. 상위 키워드와 그 비중을 보여주는데, 후기가
     * 한두 건이면 "후기 100%가 이 표현을 썼다" 같은 값이 나와 오해를 만듭니다.
     *
     * <p>{@code keywords_extracted_at} 으로 판단합니다. 키워드 행의 유무로 판단하면 향 표현이
     * 없어 키워드가 0개인 후기를 매 주기 다시 보냅니다.
     *
     * <p>비활성 향수는 제외합니다. 조회 API 가 비활성 향수에 404 를 주므로 키워드를 뽑아도
     * 보이지 않고, AI 호출 비용만 나갑니다.
     *
     * <p>후기가 많은 향수부터 처리합니다. 한 번에 처리할 향수 수를 {@code Pageable} 로 제한하는데,
     * 정렬이 없으면 어떤 향수가 잘려 나갈지 데이터베이스가 정합니다. 처리한 후기는 추출 시각이
     * 남아 다음 실행의 대상에서 빠지므로, 뒤로 밀린 향수도 다음 실행에서 차례가 옵니다.
     */
    @Query("""
            SELECT new com.hyanghae.backend.perfume.repository.KeywordExtractionTarget(
                       p.id,
                       COUNT(r.id),
                       SUM(CASE WHEN r.keywordsExtractedAt IS NULL
                                 AND r.content IS NOT NULL
                                 AND LENGTH(TRIM(r.content)) > 0
                                THEN 1 ELSE 0 END))
            FROM PerfumeReview r
            JOIN r.perfume p
            WHERE p.active = true
            GROUP BY p.id
            HAVING COUNT(r.id) >= :minReviewCount
               AND SUM(CASE WHEN r.keywordsExtractedAt IS NULL
                             AND r.content IS NOT NULL
                             AND LENGTH(TRIM(r.content)) > 0
                            THEN 1 ELSE 0 END) > 0
            ORDER BY COUNT(r.id) DESC, p.id
            """)
    List<KeywordExtractionTarget> findKeywordExtractionTargets(
            @Param("minReviewCount") int minReviewCount,
            Pageable pageable
    );

    /**
     * 아직 키워드를 뽑지 않은 후기의 원문을 최근 작성 순으로 가져옵니다.
     *
     * <p>본문이 비어 있는 후기는 뺍니다. 뽑을 것이 없으면서 토큰만 먹습니다. 이 후기들은 추출
     * 시각도 남지 않아 계속 대상 조회에 걸리는데, 대상 선정 쿼리가 같은 조건으로 걸러내므로
     * 향수가 대상이 되지는 않습니다.
     *
     * <p>{@code created_at} 이 비어 있을 수 있어 {@code NULLS LAST} 와 후기 번호를 함께
     * 씁니다. 정렬이 흔들리면 개수 제한에 걸려 잘리는 후기가 실행마다 달라집니다.
     */
    @Query("""
            SELECT new com.hyanghae.backend.perfume.repository.ReviewContent(
                       r.id, r.title, r.content)
            FROM PerfumeReview r
            WHERE r.perfume.id = :perfumeId
              AND r.keywordsExtractedAt IS NULL
              AND r.content IS NOT NULL
              AND LENGTH(TRIM(r.content)) > 0
            ORDER BY r.createdAt DESC NULLS LAST, r.id DESC
            """)
    List<ReviewContent> findContentsWithoutKeywords(
            @Param("perfumeId") Long perfumeId,
            Pageable pageable
    );

    /**
     * 키워드를 뽑은 후기에 그 시각을 남깁니다.
     *
     * <p>키워드가 하나도 나오지 않은 후기에도 남깁니다. 그것이 이 컬럼을 둔 이유입니다. 향 표현이
     * 없다고 판정된 후기를 매 주기 다시 보내지 않으려면, "뽑아 봤지만 없었다"와 "아직 뽑지
     * 않았다"가 구분되어야 합니다.
     */
    @Modifying
    @Query("""
            UPDATE PerfumeReview r
            SET r.keywordsExtractedAt = :extractedAt
            WHERE r.id IN :reviewIds
            """)
    void markKeywordsExtracted(
            @Param("reviewIds") Collection<Long> reviewIds,
            @Param("extractedAt") Instant extractedAt
    );
}
