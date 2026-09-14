package com.hyanghae.backend.community.entity;

import jakarta.persistence.EmbeddedId;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;

/**
 * {@code post_likes} 테이블 매핑입니다. 누가 어느 글에 좋아요를 눌렀는지입니다.
 *
 * <p>숫자만 두지 않는 이유가 셋입니다. 취소하려면 누구 것을 지울지 알아야 하고, 한 사람이 여러 번
 * 누르는 것을 막아야 하며, 화면이 "내가 이미 눌렀는지" 를 알아야 합니다.
 *
 * <p>{@code created_at} 은 일부러 매핑하지 않습니다. 읽는 곳이 없고, 넣는 것은 저장소의
 * {@code ON CONFLICT} 문장이라 자바가 값을 만들 일이 없습니다. 표의 기본값이 채웁니다.
 */
@Entity
@Table(name = "post_likes")
public class PostLike {

    @EmbeddedId
    private PostLikeId id;

    protected PostLike() {
        // JPA 가 요구하는 기본 생성자입니다.
    }
}
