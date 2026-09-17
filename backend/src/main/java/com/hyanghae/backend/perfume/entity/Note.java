package com.hyanghae.backend.perfume.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

/** {@code notes} 테이블 매핑입니다. 향조를 구성하는 개별 노트의 마스터 데이터입니다. */
@Entity
@Table(name = "notes")
public class Note {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "note_id")
    private Long id;

    @Column(name = "name", length = 100)
    private String name;

    @Column(name = "name_ko", length = 100)
    private String nameKo;

    @Column(name = "accord_family", length = 30)
    private String accordFamily;

    @Column(name = "image_url")
    private String imageUrl;

    /**
     * 노트 설명입니다. 채워지는 대로 들어와 비어 있을 수 있습니다.
     *
     * <p>목록에는 나가지 않습니다 — 활성 노트 전체를 한 번에 돌려주는 응답이라 설명까지
     * 실으면 크게 무거워집니다. 상세에서만 씁니다.
     */
    @Column(name = "description")
    private String description;

    @Column(name = "popularity_rank")
    private Integer popularityRank;

    @Column(name = "is_active", nullable = false)
    private boolean active;

    protected Note() {
        // JPA 가 요구하는 기본 생성자입니다.
    }
}
