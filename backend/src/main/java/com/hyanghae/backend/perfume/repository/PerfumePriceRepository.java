package com.hyanghae.backend.perfume.repository;

import com.hyanghae.backend.perfume.dto.response.PerfumePriceResponse;
import com.hyanghae.backend.perfume.entity.PerfumePrice;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface PerfumePriceRepository extends JpaRepository<PerfumePrice, Long> {

    /**
     * 향수의 가격을 용량 오름차순으로 조회합니다.
     *
     * <p>{@code volume_ml} 이 {@code NULL} 인 행은 뒤로 밀고, 값이 같을 때는 {@code price_id} 로
     * 순서를 확정해 매번 같은 순서가 나오게 합니다.
     */
    @Query("""
            SELECT new com.hyanghae.backend.perfume.dto.response.PerfumePriceResponse(
                       p.volumeMl, p.minPrice, p.maxPrice, p.collectedAt)
            FROM PerfumePrice p
            WHERE p.perfume.id = :perfumeId
            ORDER BY p.volumeMl ASC NULLS LAST, p.id
            """)
    List<PerfumePriceResponse> findByPerfumeId(@Param("perfumeId") Long perfumeId);
}
