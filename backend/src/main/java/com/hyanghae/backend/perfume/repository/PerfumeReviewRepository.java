package com.hyanghae.backend.perfume.repository;

import com.hyanghae.backend.perfume.entity.PerfumeReview;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

/**
 * 후기 통계 조회입니다.
 *
 * <p>향수에 달린 후기를 전부 셉니다. 보류 개념이 정리되면서 {@code perfume_reviews.status} 가
 * 없어질 예정이라, 상태로 걸러낼 후기가 없습니다.
 */
public interface PerfumeReviewRepository extends JpaRepository<PerfumeReview, Long> {

    /**
     * 향수의 후기 수입니다.
     *
     * <p>AI 후기 요약의 재생성 시점을 판단하는 기준이라, 요약 파이프라인이 요약 대상 후기를
     * 세는 기준과 같아야 합니다. 지금은 양쪽 다 향수에 달린 모든 후기입니다.
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
}
