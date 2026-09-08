package com.hyanghae.backend.perfume.repository;

import com.hyanghae.backend.perfume.entity.PerfumeImage;
import java.util.Collection;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface PerfumeImageRepository extends JpaRepository<PerfumeImage, Long> {

    /**
     * 주어진 향수들의 이미지를 대표 이미지가 먼저 오도록 정렬해 조회합니다.
     * 향수당 여러 행이 나오므로, 호출한 쪽이 향수별 첫 행만 취해야 합니다.
     *
     * <p>{@code display_order} 가 {@code NULL} 인 행은 뒤로 밀고, 값이 같을 때는
     * {@code image_id} 로 순서를 확정해 매번 같은 이미지가 대표로 뽑히게 합니다.
     */
    @Query("""
            SELECT new com.hyanghae.backend.perfume.repository.PerfumeThumbnail(i.perfume.id, i.imageUrl)
            FROM PerfumeImage i
            WHERE i.perfume.id IN :perfumeIds
            ORDER BY i.perfume.id, i.displayOrder ASC NULLS LAST, i.id
            """)
    List<PerfumeThumbnail> findOrderedByPerfumeIds(@Param("perfumeIds") Collection<Long> perfumeIds);
}
