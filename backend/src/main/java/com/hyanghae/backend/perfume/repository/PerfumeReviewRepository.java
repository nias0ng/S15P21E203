package com.hyanghae.backend.perfume.repository;

import com.hyanghae.backend.perfume.entity.PerfumeReview;
import java.util.List;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

/**
 * 후기 통계 조회와 요약 대상 조회입니다.
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
     * <p>메모({@code memos})는 세지 않습니다. 기능 명세서의 시스템 처리 항목에
     * 메모를 함께 분석한다는 문장이 있으나, 팀이 후기만 쓰기로 정했습니다.
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
     * 후기 요약을 새로 만들어야 하는 향수를 찾습니다.
     *
     * <p>조건은 두 가지입니다. 요약할 수 있는 후기가 {@code minReviewCount} 개 이상이어야 하고,
     * 요약이 아직 없거나 요약을 만든 뒤로 후기가 {@code regenerationStep} 개 이상 늘어나 있어야
     * 합니다. 요구사항 정의서 DTL-23 의 "일정 개수 이상의 후기가 존재하는 경우 요약을 제공한다"가
     * 앞 조건이고, 뒤 조건은 매번 전체 향수를 다시 요약하지 않기 위한 것입니다.
     *
     * <p>앞 조건은 본문이 있는 후기만 셉니다. 후기 작성 API 와 스키마가 본문을 필수로 막지 않아
     * 공백만 있는 후기가 들어올 수 있습니다. 그런 후기까지 세면 본문이 스무 건 비어 있는 향수가
     * 대상이 되어 {@link #findContentsByPerfumeId} 가 빈 목록을 돌려주고, 요약을 만들지 못해
     * {@code source_review_count} 도 오르지 않습니다. 그러면 그 향수는 매 실행마다 다시 대상이
     * 되어 한 실행의 처리 상한을 계속 차지합니다. 본문이 제대로 있는 향수가 그만큼 밀립니다.
     *
     * <p>반면 뒤 조건과 {@link ReviewSummaryTarget#reviewCount()} 는 전체 후기 수입니다. 이
     * 값이 {@code source_review_count} 로 저장되고 후기 통계 API 의 {@code reviewCount} 와
     * 비교되므로, 양쪽이 같은 것을 세야 합니다.
     *
     * <p>비활성 향수는 제외합니다. 조회 API 가 비활성 향수에 404 를 주므로 요약을 만들어도
     * 보이지 않고, AI 호출 비용만 나갑니다.
     *
     * <p>후기가 하나도 없는 향수는 {@code PerfumeReview} 를 기준으로 시작하는 것만으로 빠집니다.
     * 어차피 {@code minReviewCount} 조건에 걸립니다.
     *
     * <p>요약할 수 있는 후기가 많은 향수부터 처리합니다. 한 번에 처리할 향수 수를
     * {@code Pageable} 로 제한하는데, 정렬이 없으면 어떤 향수가 잘려 나갈지 데이터베이스가
     * 정합니다. 처리한 향수는 {@code source_review_count} 가 올라가 다음 실행의 대상에서
     * 빠지므로, 뒤로 밀린 향수도 다음 실행에서 차례가 옵니다.
     */
    @Query("""
            SELECT new com.hyanghae.backend.perfume.repository.ReviewSummaryTarget(
                       p.id, COUNT(r.id))
            FROM PerfumeReview r
            JOIN r.perfume p
            LEFT JOIN PerfumeReviewSummary s ON s.perfumeId = p.id
            WHERE p.active = true
            GROUP BY p.id, s.sourceReviewCount
            HAVING SUM(CASE WHEN r.content IS NOT NULL AND LENGTH(TRIM(r.content)) > 0
                            THEN 1 ELSE 0 END) >= :minReviewCount
               AND (s.sourceReviewCount IS NULL
                    OR COUNT(r.id) - s.sourceReviewCount >= :regenerationStep)
            ORDER BY SUM(CASE WHEN r.content IS NOT NULL AND LENGTH(TRIM(r.content)) > 0
                              THEN 1 ELSE 0 END) DESC, p.id
            """)
    List<ReviewSummaryTarget> findSummaryTargets(
            @Param("minReviewCount") int minReviewCount,
            @Param("regenerationStep") int regenerationStep,
            Pageable pageable
    );

    /**
     * AI 에게 보낼 후기 원문을 최근 작성 순으로 가져옵니다.
     *
     * <p>본문이 비어 있는 후기는 뺍니다. 요약에 아무것도 보태지 못하면서 토큰만 먹습니다.
     * {@link #findSummaryTargets} 가 대상을 고를 때 세는 후기도 같은 기준입니다. 두 기준이
     * 어긋나면 보낼 것이 없는 향수가 대상으로 잡힙니다.
     *
     * <p>그렇다고 {@link #countByPerfumeId} 의 기준을 바꾸지는 않습니다. 요약이 최신인지
     * 판단하는 기준은 "향수에 달린 후기 수"여야 하고, 본문이 빈 후기도 그 수에는 들어갑니다.
     *
     * <p>{@code created_at} 이 비어 있을 수 있어 {@code NULLS LAST} 와 후기 번호를 함께
     * 씁니다. 정렬이 흔들리면 개수 제한에 걸려 잘리는 후기가 실행마다 달라집니다.
     */
    @Query("""
            SELECT new com.hyanghae.backend.perfume.repository.ReviewContent(
                       r.id, r.title, r.content)
            FROM PerfumeReview r
            WHERE r.perfume.id = :perfumeId
              AND r.content IS NOT NULL
              AND LENGTH(TRIM(r.content)) > 0
            ORDER BY r.createdAt DESC NULLS LAST, r.id DESC
            """)
    List<ReviewContent> findContentsByPerfumeId(
            @Param("perfumeId") Long perfumeId,
            Pageable pageable
    );
}
