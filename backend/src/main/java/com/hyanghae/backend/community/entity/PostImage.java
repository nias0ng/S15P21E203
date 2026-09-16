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
 * <p>주소만 담습니다. 파일은 {@code POST /api/v1/posts/images} 가 받아 저장하고 주소를
 * 돌려주며, 화면이 그 주소를 게시글 API 로 보냅니다. 여기에 파일이 오는 일은 없습니다.
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
