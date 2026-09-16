package com.hyanghae.backend.review.repository;

import com.hyanghae.backend.review.entity.ReviewLike;
import com.hyanghae.backend.review.entity.ReviewLikeId;
import java.util.Collection;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

/**
 * 후기 좋아요를 읽고 씁니다. 글 좋아요와 규칙이 같습니다.
 *
 * <p><b>누르기만 네이티브 쿼리입니다.</b> 좋아요는 여러 번 눌러도 결과가 같아야 하는데, 먼저
 * 확인하고 없으면 넣는 식으로 쓰면 두 요청이 동시에 들어올 때 둘 다 "없음" 을 보고 둘 다 넣으려
 * 합니다. 그러면 한쪽이 기본키 충돌로 500 을 받습니다. PostgreSQL 의 {@code ON CONFLICT DO
 * NOTHING} 은 이 확인과 삽입을 한 문장으로 처리해 그 틈이 없습니다.
 */
@Repository
public interface ReviewLikeRepository extends JpaRepository<ReviewLike, ReviewLikeId> {

    /**
     * 좋아요를 누릅니다. 이미 눌러 두었으면 아무 일도 일어나지 않습니다.
     *
     * @return 실제로 들어간 행 수. 처음 누르면 1, 이미 눌러 두었으면 0
     */
    @Modifying
    @Query(value = """
            INSERT INTO review_likes (review_id, user_id, created_at)
            VALUES (:reviewId, :userId, NOW())
            ON CONFLICT DO NOTHING
            """, nativeQuery = true)
    int like(@Param("reviewId") Long reviewId, @Param("userId") Long userId);

    /** 좋아요를 취소합니다. 누르지 않았으면 아무 일도 일어나지 않습니다. */
    @Modifying
    @Query("""
            DELETE FROM ReviewLike l
            WHERE l.id.reviewId = :reviewId AND l.id.userId = :userId
            """)
    int unlike(@Param("reviewId") Long reviewId, @Param("userId") Long userId);

    @Query("SELECT COUNT(l) FROM ReviewLike l WHERE l.id.reviewId = :reviewId")
    long countOfReview(@Param("reviewId") Long reviewId);

    @Query("""
            SELECT COUNT(l) > 0
            FROM ReviewLike l
            WHERE l.id.reviewId = :reviewId AND l.id.userId = :userId
            """)
    boolean isLikedBy(@Param("reviewId") Long reviewId, @Param("userId") Long userId);

    /**
     * 이 후기들 중 내가 누른 것입니다.
     *
     * <p>후기마다 따로 물으면 한 페이지에 쿼리가 스무 번 나갑니다. 번호를 모아 한 번에 읽습니다.
     */
    @Query("""
            SELECT l.id.reviewId
            FROM ReviewLike l
            WHERE l.id.userId = :userId AND l.id.reviewId IN :reviewIds
            """)
    List<Long> findLikedReviewIds(
            @Param("userId") Long userId,
            @Param("reviewIds") Collection<Long> reviewIds
    );
}
