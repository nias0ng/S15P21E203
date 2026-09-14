package com.hyanghae.backend.community.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;
import java.io.Serializable;
import java.util.Objects;

/**
 * {@code post_likes} 의 복합 기본키입니다.
 *
 * <p>글과 사람을 함께 기본키로 둡니다. 같은 사람이 같은 글에 두 번 누르면 표가 거부합니다.
 */
@Embeddable
public class PostLikeId implements Serializable {

    @Column(name = "post_id")
    private Long postId;

    @Column(name = "user_id")
    private Long userId;

    protected PostLikeId() {
        // JPA 가 요구하는 기본 생성자입니다.
    }

    private PostLikeId(Long postId, Long userId) {
        this.postId = postId;
        this.userId = userId;
    }

    public static PostLikeId of(Long postId, Long userId) {
        return new PostLikeId(postId, userId);
    }

    @Override
    public boolean equals(Object other) {
        if (this == other) {
            return true;
        }
        if (!(other instanceof PostLikeId that)) {
            return false;
        }
        return Objects.equals(postId, that.postId) && Objects.equals(userId, that.userId);
    }

    @Override
    public int hashCode() {
        return Objects.hash(postId, userId);
    }
}
