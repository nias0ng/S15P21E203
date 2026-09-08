package com.hyanghae.backend.perfume.entity;

import jakarta.persistence.Column;
import jakarta.persistence.EmbeddedId;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;

/**
 * {@code perfume_notes} 테이블 매핑입니다. 향수와 노트를 잇고 어느 단계의 노트인지를 담습니다.
 *
 * <p>연관관계 대신 복합키를 그대로 매핑했습니다. 조회 전용이라 객체 그래프를 탐색할 일이 없고,
 * 조인 조건을 쿼리에 드러내는 편이 읽기 쉽습니다.
 *
 * <p>{@code note_type} 은 {@code VARCHAR(30)} 이고 값 제약이 없습니다. 백엔드는 값을 해석하지 않고
 * 그대로 전달합니다. 세 단계로 미리 나눠 담으면 예상하지 못한 값이 조용히 버려집니다.
 */
@Entity
@Table(name = "perfume_notes")
public class PerfumeNote {

    @EmbeddedId
    private PerfumeNoteId id;

    @Column(name = "note_type", length = 30)
    private String noteType;

    protected PerfumeNote() {
        // JPA 가 요구하는 기본 생성자입니다.
    }
}
