package com.hyanghae.backend.community.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;

/**
 * {@code post_images} 테이블 매핑입니다.
 *
 * <p>주소만 담습니다. 파일을 올리는 방법이 정해지면 그 API 가 주소를 돌려주고, 화면이 그것을
 * 게시글 API 로 보내면 됩니다.
 *
 * <p>{@code displayOrder} 는 화면에 보일 순서입니다. 순서를 지키지 않으면 화면이 고른 대표
 * 이미지가 매번 달라집니다.
 */
@Entity
@Table(name = "post_images")
public class PostImage {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "image_id")
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "post_id", nullable = false)
    private Post post;

    @Column(name = "image_url")
    private String imageUrl;

    @Column(name = "display_order")
    private Integer displayOrder;

    protected PostImage() {
        // JPA 가 요구하는 기본 생성자입니다.
    }

    static PostImage create(Post post, String imageUrl, int displayOrder) {
        PostImage image = new PostImage();
        image.post = post;
        image.imageUrl = imageUrl;
        image.displayOrder = displayOrder;
        return image;
    }
}
