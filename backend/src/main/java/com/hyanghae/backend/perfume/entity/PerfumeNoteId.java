package com.hyanghae.backend.perfume.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;
import java.io.Serializable;
import java.util.Objects;

/**
 * {@code perfume_notes} 의 복합 기본키입니다.
 *
 * <p>JPA 는 복합키를 별도 타입으로 요구하고, 그 타입은 {@link Serializable} 이면서
 * {@code equals}/{@code hashCode} 를 가져야 합니다. 영속성 컨텍스트가 이 값으로 엔티티를
 * 식별하기 때문입니다.
 */
@Embeddable
public class PerfumeNoteId implements Serializable {

    @Column(name = "perfume_id")
    private Long perfumeId;

    @Column(name = "note_id")
    private Long noteId;

    protected PerfumeNoteId() {
        // JPA 가 요구하는 기본 생성자입니다.
    }

    @Override
    public boolean equals(Object other) {
        if (this == other) {
            return true;
        }
        if (!(other instanceof PerfumeNoteId that)) {
            return false;
        }
        return Objects.equals(perfumeId, that.perfumeId) && Objects.equals(noteId, that.noteId);
    }

    @Override
    public int hashCode() {
        return Objects.hash(perfumeId, noteId);
    }
}
