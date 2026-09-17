package com.hyanghae.backend.perfume.repository;

import com.hyanghae.backend.perfume.dto.response.PerfumeReviewSummaryResponse;
import com.hyanghae.backend.perfume.entity.PerfumeReviewSummary;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface PerfumeReviewSummaryRepository extends JpaRepository<PerfumeReviewSummary, Long> {

    /** 향수의 후기 요약을 조회합니다. 요약이 없으면 빈 {@link Optional} 입니다. */
    @Query("""
            SELECT new com.hyanghae.backend.perfume.dto.response.PerfumeReviewSummaryResponse(
                       s.summaryText, s.sourceReviewCount, s.updatedAt)
            FROM PerfumeReviewSummary s
            WHERE s.perfumeId = :perfumeId
            """)
    Optional<PerfumeReviewSummaryResponse> findResponseByPerfumeId(@Param("perfumeId") Long perfumeId);
}
