package com.hyanghae.backend.perfume.repository;

import com.hyanghae.backend.perfume.dto.response.RelatedPerfumeResponse;
import com.hyanghae.backend.perfume.entity.PerfumeNeighbor;
import com.hyanghae.backend.perfume.entity.PerfumeNeighborId;
import java.util.List;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface PerfumeNeighborRepository
        extends JpaRepository<PerfumeNeighbor, PerfumeNeighborId> {

    /**
     * 기준 향수와 이어진 향수들을 조회합니다. 주변 향수와 유사 향수가 같은 결과를 씁니다.
     *
     * <p>비활성 향수는 제외합니다. 검색과 기본 정보 조회에서 이미 숨긴 향수가 주변 향수 목록으로
     * 다시 나타나면, 눌렀을 때 404 가 나는 항목을 화면에 그리게 됩니다.
     *
     * <p>{@code ORDER BY p.id} 는 가까운 순이 아닙니다. {@code perfume_neighbors} 에 거리나
     * 순위 컬럼이 없어 정할 근거가 없습니다. 그래도 순서를 고정해야 {@code size} 로 자를 때
     * 매번 같은 결과가 나옵니다. 순위 컬럼이 생기면 이 절만 바꾸면 됩니다.
     */
    @Query("""
            SELECT new com.hyanghae.backend.perfume.dto.response.RelatedPerfumeResponse(
                       p.id, p.name, p.nameKo)
            FROM PerfumeNeighbor n, Perfume p
            WHERE n.id.neighborPerfumeId = p.id
              AND n.id.perfumeId = :perfumeId
              AND p.active = true
            ORDER BY p.id
            """)
    List<RelatedPerfumeResponse> findNeighborsByPerfumeId(
            @Param("perfumeId") Long perfumeId, Pageable pageable);
}
