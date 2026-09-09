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
     * <p>연관관계를 매핑하지 않아 {@code JOIN ... ON} 으로 조인 조건을 직접 씁니다. 조인 조건을
     * {@code WHERE} 에 섞어 쓰면 어디까지가 조인이고 어디부터가 걸러내는 조건인지 구분되지
     * 않습니다.
     *
     * <p>비활성 향수는 제외합니다. 검색과 기본 정보 조회에서 이미 숨긴 향수가 주변 향수 목록으로
     * 다시 나타나면, 눌렀을 때 404 가 나는 항목을 화면에 그리게 됩니다.
     *
     * <p>닮은 순입니다. {@code rank} 가 비어 있는 행은 뒤로 밀고, 같으면 향수 id 로 순서를
     * 확정합니다. 순서를 고정해야 {@code size} 로 자를 때 매번 같은 결과가 나옵니다.
     */
    @Query("""
            SELECT new com.hyanghae.backend.perfume.dto.response.RelatedPerfumeResponse(
                       p.id, p.name, p.nameKo)
            FROM PerfumeNeighbor n
            JOIN Perfume p ON p.id = n.id.neighborPerfumeId
            WHERE n.id.perfumeId = :perfumeId
              AND p.active = true
            ORDER BY n.rank ASC NULLS LAST, p.id
            """)
    List<RelatedPerfumeResponse> findNeighborsByPerfumeId(
            @Param("perfumeId") Long perfumeId, Pageable pageable);
}
