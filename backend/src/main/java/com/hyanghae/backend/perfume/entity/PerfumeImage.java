package com.hyanghae.backend.perfume.entity;

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
 * {@code perfume_images} 테이블 매핑입니다.
 *
 * <p>대표 이미지를 가리키는 플래그 컬럼이 없으므로 {@code display_order} 가 가장 작은 것을
 * 대표로 봅니다. 값이 {@code NULL} 인 행은 뒤로 밀립니다.
 */
@Entity
@Table(name = "perfume_images")
public class PerfumeImage {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "image_id")
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "perfume_id")
    private Perfume perfume;

    @Column(name = "image_url")
    private String imageUrl;

    @Column(name = "display_order")
    private Integer displayOrder;

    protected PerfumeImage() {
        // JPA 가 요구하는 기본 생성자입니다.
    }
}
