package com.hyanghae.backend.perfume.repository;

import com.hyanghae.backend.perfume.dto.response.PerfumeNoteResponse;
import com.hyanghae.backend.perfume.dto.response.PerfumeSummaryResponse;
import com.hyanghae.backend.perfume.entity.PerfumeNote;
import com.hyanghae.backend.perfume.entity.PerfumeNoteId;
import java.util.List;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
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

    /**
     * 그 노트가 들어간 향수입니다. 노트 상세 화면(와이어프레임 A36)이 씁니다.
     *
     * <p><b>페이지가 있습니다.</b> 노트 목록과 다른 점입니다 — 노트는 246개로 끝이지만 향수는
     * 인기 노트 하나에 수만 개가 달립니다(머스크 49,571개). 한 번에 내보낼 수 없습니다.
     *
     * <p>비활성 향수는 뺍니다. 검색·상세와 같은 기준입니다. {@code brand_id} 가 nullable 이라
     * {@code LEFT JOIN} 입니다 — 안쪽 조인으로 두면 브랜드가 없는 향수가 통째로 사라집니다.
     *
     * <p>순서를 향수 번호로 확정합니다. {@code ORDER BY} 없는 페이징은 데이터베이스가 행 순서를
     * 보장하지 않아, 2페이지에 1페이지 향수가 다시 나오거나 어떤 향수가 아예 빠질 수 있습니다.
     *
     * <p>[측정] 향수 129,163개 · 연결 905,542행에서 가장 큰 노트(머스크, 향수 49,213개)를 기준으로
     * 첫 페이지 46ms · 100페이지 56ms · 500페이지 68ms · <b>마지막 2,460페이지 1.04초</b>입니다.
     * {@code OFFSET} 이 앞의 행을 모두 세기 때문에 뒤로 갈수록 느려집니다. 화면이 훑어 내려가는
     * 방식이라 앞쪽만 쓰므로 그대로 둡니다. 끝까지 가는 사용이 생기면 마지막으로 본 향수 번호를
     * 받아 {@code WHERE p.id > :lastId} 로 바꾸면 됩니다.
     *
     * <p>{@code note_id} 전용 인덱스를 두지 않습니다. 복합 기본키가 {@code (perfume_id, note_id)}
     * 라 선두 컬럼이 아닌데도 실행 계획이 {@code Index Only Scan} 을 씁니다 — 인덱스가 좁아
     * 훑어도 싼 쪽입니다. 확인한 계획에서 이 조인에 든 버퍼가 622개였습니다.
     */
    @Query(value = """
            SELECT new com.hyanghae.backend.perfume.dto.response.PerfumeSummaryResponse(
                       p.id, p.name, p.nameKo, b.name, b.nameKo)
            FROM PerfumeNote pn, Perfume p
            LEFT JOIN p.brand b
            WHERE pn.id.perfumeId = p.id
              AND pn.id.noteId = :noteId
              AND p.active = true
            ORDER BY p.id
            """,
            countQuery = """
                    SELECT COUNT(p)
                    FROM PerfumeNote pn, Perfume p
                    WHERE pn.id.perfumeId = p.id
                      AND pn.id.noteId = :noteId
                      AND p.active = true
                    """)
    Page<PerfumeSummaryResponse> findPerfumePageByNoteId(
            @Param("noteId") Long noteId, Pageable pageable);
}
