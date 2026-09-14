package com.hyanghae.backend.review.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;
import java.io.Serializable;
import java.util.Objects;

/**
 * {@code review_likes} 의 복합 기본키입니다.
 *
 * <p>후기와 사람을 함께 기본키로 둡니다. 같은 사람이 같은 후기에 두 번 누르면 표가 거부합니다.
 */
@Embeddable
public class ReviewLikeId implements Serializable {

    @Column(name = "review_id")
    private Long reviewId;

    @Column(name = "user_id")
    private Long userId;

    protected ReviewLikeId() {
        // JPA 가 요구하는 기본 생성자입니다.
    }

    private ReviewLikeId(Long reviewId, Long userId) {
        this.reviewId = reviewId;
        this.userId = userId;
    }

    public static ReviewLikeId of(Long reviewId, Long userId) {
        return new ReviewLikeId(reviewId, userId);
    }

    @Override
    public boolean equals(Object other) {
        if (this == other) {
            return true;
        }
        if (!(other instanceof ReviewLikeId that)) {
            return false;
        }
        return Objects.equals(reviewId, that.reviewId) && Objects.equals(userId, that.userId);
    }

    @Override
    public int hashCode() {
        return Objects.hash(reviewId, userId);
    }
}
