package com.hyanghae.backend.review.repository;

import com.hyanghae.backend.review.entity.PerfumeReviewSeason;
import com.hyanghae.backend.review.entity.PerfumeReviewSeasonId;
import java.util.Collection;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface PerfumeReviewSeasonRepository
        extends JpaRepository<PerfumeReviewSeason, PerfumeReviewSeasonId> {

    @Modifying
    @Query("DELETE FROM PerfumeReviewSeason rs WHERE rs.id.reviewId = :reviewId")
    void deleteAllByReviewId(@Param("reviewId") Long reviewId);

    @Query("""
            SELECT new com.hyanghae.backend.review.repository.ReviewSeasonRow(
                       rs.id.reviewId,
                       s.id,
                       s.code,
                       s.name
                   )
            FROM PerfumeReviewSeason rs
            JOIN Season s ON s.id = rs.id.seasonId
            WHERE rs.id.reviewId IN :reviewIds
            ORDER BY s.id
            """)
    List<ReviewSeasonRow> findAllByReviewIds(
            @Param("reviewIds") Collection<Long> reviewIds
    );
}
