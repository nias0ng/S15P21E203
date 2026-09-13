package com.hyanghae.backend.community.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

/**
 * {@code post_categories} 테이블 매핑입니다.
 *
 * <p>자유 게시판의 글 분류입니다. 컬렉션 공유·추천·잡담 셋을 마이그레이션이 심어 둡니다.
 *
 * <p>화면과는 {@code code} 로 주고받습니다. 번호는 자동 증가라 환경마다 다르고, 화면은
 * 와이어프레임이 정한 코드만 알고 있습니다.
 */
@Entity
@Table(name = "post_categories")
public class PostCategory {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "category_id")
    private Long id;

    @Column(name = "code", length = 30)
    private String code;

    @Column(name = "name", length = 100)
    private String name;

    @Column(name = "is_active", nullable = false)
    private boolean active;

    protected PostCategory() {
        // JPA 가 요구하는 기본 생성자입니다.
    }

    public Long getId() {
        return id;
    }

    public String getCode() {
        return code;
    }
}
