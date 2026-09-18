package com.hyanghae.backend.perfume.repository;

import com.hyanghae.backend.perfume.dto.response.NoteDetailResponse;
import com.hyanghae.backend.perfume.dto.response.NoteSummaryResponse;
import com.hyanghae.backend.perfume.entity.Note;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

/**
 * 노트 목록과 상세를 읽습니다.
 *
 * <p>페이지가 없습니다. 노트 목록 화면(와이어프레임 A35)이 <b>대분류로 묶어</b> 한 화면에 뿌립니다.
 * 묶으려면 전부가 있어야 하고, 지금 246개이며 향수처럼 늘어나는 값이 아닙니다. 브랜드 목록도
 * 같은 이유로 페이지를 두지 않았습니다.
 */
@Repository
public interface NoteRepository extends JpaRepository<Note, Long> {

    /**
     * 활성 노트 전부입니다.
     *
     * <p>대분류로 먼저 묶고 그 안에서 인기 순위대로 세웁니다. 화면이 구역을 나눠 그리므로 같은
     * 대분류가 흩어지면 안 됩니다.
     *
     * <p>순위가 없는 노트는 뒤로 밉니다. 순위가 같거나 없을 때를 대비해 이름까지 이어 붙입니다 —
     * 화면을 다시 열어도 같은 차례로 보여야 합니다.
     */
    @Query("""
            SELECT new com.hyanghae.backend.perfume.dto.response.NoteSummaryResponse(
                       n.id, n.name, n.nameKo, n.accordFamily, n.imageUrl, n.popularityRank)
            FROM Note n
            WHERE n.active = true
            ORDER BY n.accordFamily, n.popularityRank ASC NULLS LAST, n.name
            """)
    List<NoteSummaryResponse> findAllActive();

    /**
     * 노트 하나입니다. 내려간 노트는 조회되지 않습니다. 향수 검색이 비활성을 빼는 것과 같습니다.
     *
     * <p>목록과 달리 <b>설명을 함께</b> 읽습니다. 목록은 활성 노트 전체를 돌려주는 응답이라
     * 설명까지 실으면 크게 무거워집니다.
     */
    @Query("""
            SELECT new com.hyanghae.backend.perfume.dto.response.NoteDetailResponse(
                       n.id, n.name, n.nameKo, n.accordFamily, n.imageUrl, n.popularityRank,
                       n.description)
            FROM Note n
            WHERE n.id = :noteId
              AND n.active = true
            """)
    Optional<NoteDetailResponse> findActiveById(@Param("noteId") Long noteId);

    /** 하위 목록이 404 를 내야 하는지 판단할 때 씁니다. 향수 쪽 {@code existsByIdAndActiveTrue} 와 같습니다. */
    boolean existsByIdAndActiveTrue(Long noteId);
}
