package com.hyanghae.backend.perfume.repository;

import com.hyanghae.backend.perfume.dto.response.RelatedPerfumeResponse;
import com.hyanghae.backend.perfume.entity.PerfumeSimilar;
import com.hyanghae.backend.perfume.entity.PerfumeSimilarId;
import java.util.List;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface PerfumeSimilarRepository extends JpaRepository<PerfumeSimilar, PerfumeSimilarId> {

    /**
     * 기준 향수와 닮은 향수들을 닮은 순으로 조회합니다.
     *
     * <p>{@link PerfumeNeighborRepository#findNeighborsByPerfumeId} 와 같은 모양입니다 — 응답이
     * 같아야 화면이 어느 표에서 왔는지 몰라도 됩니다. 비활성 향수를 빼는 까닭도 같습니다. 눌렀을 때
     * 404 가 나는 향수를 화면에 그리지 않습니다.
     *
     * <p>{@code rank} 가 한 향수 안에서 겹치지 않으므로({@code uk_perfume_similars_rank}) 순서가
     * 하나로 정해집니다.
     */
    @Query("""
            SELECT new com.hyanghae.backend.perfume.dto.response.RelatedPerfumeResponse(
                       p.id, p.name, p.nameKo)
            FROM PerfumeSimilar s
            JOIN Perfume p ON p.id = s.id.similarPerfumeId
            WHERE s.id.perfumeId = :perfumeId
              AND p.active = true
            ORDER BY s.rank ASC
            """)
    List<RelatedPerfumeResponse> findSimilarsByPerfumeId(
            @Param("perfumeId") Long perfumeId, Pageable pageable);
}
