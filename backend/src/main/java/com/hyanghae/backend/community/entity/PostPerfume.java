package com.hyanghae.backend.community.entity;

import com.hyanghae.backend.perfume.entity.Perfume;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.Id;
import jakarta.persistence.IdClass;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;

/**
 * {@code post_perfumes} 테이블 매핑입니다. 글에 걸어 둔 향수입니다.
 *
 * <p>기본키가 (글, 향수)라 같은 향수를 두 번 걸 수 없습니다. 서비스가 중복을 400 으로 먼저
 * 막지만, 다른 경로로 들어와도 이 제약이 지킵니다.
 */
@Entity
@Table(name = "post_perfumes")
@IdClass(PostPerfumeId.class)
public class PostPerfume {

    @Id
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "post_id", nullable = false)
    private Post post;

    @Id
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "perfume_id", nullable = false)
    private Perfume perfume;

    @Column(name = "display_order")
    private Integer displayOrder;

    protected PostPerfume() {
        // JPA 가 요구하는 기본 생성자입니다.
    }

    static PostPerfume create(Post post, Perfume perfume, int displayOrder) {
        PostPerfume postPerfume = new PostPerfume();
        postPerfume.post = post;
        postPerfume.perfume = perfume;
        postPerfume.displayOrder = displayOrder;
        return postPerfume;
    }
}
