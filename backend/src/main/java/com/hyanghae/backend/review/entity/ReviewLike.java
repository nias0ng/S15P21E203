package com.hyanghae.backend.review.entity;

import jakarta.persistence.EmbeddedId;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;

/**
 * {@code review_likes} 테이블 매핑입니다. 누가 어느 후기에 좋아요를 눌렀는지입니다.
 *
 * <p>글 좋아요({@code post_likes})와 규칙이 같고 매달리는 자리만 다릅니다. 표를 합치지 않은 이유는
 * V13 에 적어 두었습니다 — 한 컬럼이 두 표를 가리키면 외래키를 걸 수 없습니다.
 *
 * <p>{@code created_at} 은 일부러 매핑하지 않습니다. 읽는 곳이 없고, 넣는 것은 저장소의
 * {@code ON CONFLICT} 문장이라 자바가 값을 만들 일이 없습니다. 표의 기본값이 채웁니다.
 */
@Entity
@Table(name = "review_likes")
public class ReviewLike {

    @EmbeddedId
    private ReviewLikeId id;

    protected ReviewLike() {
        // JPA 가 요구하는 기본 생성자입니다.
    }
}
