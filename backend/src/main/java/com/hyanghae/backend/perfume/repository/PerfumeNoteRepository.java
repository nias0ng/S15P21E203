package com.hyanghae.backend.perfume.repository;

import com.hyanghae.backend.perfume.dto.response.PerfumeNoteResponse;
import com.hyanghae.backend.perfume.entity.PerfumeNote;
import com.hyanghae.backend.perfume.entity.PerfumeNoteId;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface PerfumeNoteRepository extends JpaRepository<PerfumeNote, PerfumeNoteId> {

    /**
     * 향수의 노트를 이름순으로 조회합니다.
     *
     * <p>연관관계를 매핑하지 않아 조인 조건을 쿼리에 직접 씁니다. 조회 전용이라 객체 그래프를
     * 탐색할 일이 없고, 조인이 드러나는 편이 읽기 쉽습니다.
     *
     * <p>{@code note_id} 로 순서를 확정해 이름이 같은 노트가 있어도 매번 같은 순서가 나옵니다.
     */
    @Query("""
            SELECT new com.hyanghae.backend.perfume.dto.response.PerfumeNoteResponse(
                       n.id, n.name, pn.noteType)
            FROM PerfumeNote pn, Note n
            WHERE pn.id.noteId = n.id
              AND pn.id.perfumeId = :perfumeId
            ORDER BY n.name, n.id
            """)
    List<PerfumeNoteResponse> findByPerfumeId(@Param("perfumeId") Long perfumeId);
}
