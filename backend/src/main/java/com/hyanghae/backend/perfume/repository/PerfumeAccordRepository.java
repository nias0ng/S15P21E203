package com.hyanghae.backend.perfume.repository;

import com.hyanghae.backend.perfume.dto.response.PerfumeAccordResponse;
import com.hyanghae.backend.perfume.entity.PerfumeAccord;
import com.hyanghae.backend.perfume.entity.PerfumeAccordId;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface PerfumeAccordRepository extends JpaRepository<PerfumeAccord, PerfumeAccordId> {

    /**
     * 향수의 어코드를 순위 오름차순으로 조회합니다.
     *
     * <p>{@code rank} 가 {@code NULL} 인 행은 뒤로 밀고, 값이 같을 때는 {@code accord_id} 로
     * 순서를 확정합니다.
     */
    @Query("""
            SELECT new com.hyanghae.backend.perfume.dto.response.PerfumeAccordResponse(
                       a.id, a.name, pa.rank, pa.weight)
            FROM PerfumeAccord pa, Accord a
            WHERE pa.id.accordId = a.id
              AND pa.id.perfumeId = :perfumeId
            ORDER BY pa.rank ASC NULLS LAST, a.id
            """)
    List<PerfumeAccordResponse> findByPerfumeId(@Param("perfumeId") Long perfumeId);
}
