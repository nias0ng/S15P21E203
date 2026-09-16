package com.hyanghae.backend.perfume.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
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
 * <p>일반 이미지와 종이 질감 이미지는 {@code imageType}으로 구분합니다. 기존 조회는
 * {@code display_order}가 가장 작은 일반 이미지를 대표로 사용합니다.
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

    @Enumerated(EnumType.STRING)
    @Column(name = "image_type", nullable = false, length = 30)
    private PerfumeImageType imageType;

    @Column(name = "display_order")
    private Integer displayOrder;

    protected PerfumeImage() {
        // JPA 가 요구하는 기본 생성자입니다.
    }
}
