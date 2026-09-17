package com.hyanghae.backend.perfume.repository;

import com.hyanghae.backend.perfume.entity.PerfumeImage;
import com.hyanghae.backend.perfume.entity.PerfumeImageType;
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
     *
     * <p><b>종류를 가리지 않습니다.</b> 일반 이미지가 {@code display_order} 1번이라 결과적으로
     * 그것이 뽑힙니다. 종이 질감이 필요한 곳은
     * {@link #findOrderedByPerfumeIdsPreferring} 을 쓰십시오.
     */
    @Query("""
            SELECT new com.hyanghae.backend.perfume.repository.PerfumeImageUrl(i.perfume.id, i.imageUrl)
            FROM PerfumeImage i
            WHERE i.perfume.id IN :perfumeIds
            ORDER BY i.perfume.id, i.displayOrder ASC NULLS LAST, i.id
            """)
    List<PerfumeImageUrl> findOrderedByPerfumeIds(@Param("perfumeIds") Collection<Long> perfumeIds);

    /**
     * 같은 조회이되 <b>원하는 종류를 먼저</b> 놓습니다. 진열대와 컬렉션이 씁니다.
     *
     * <p>향수 한 건에 일반 이미지와 종이 질감 이미지가 함께 있습니다. 위의
     * {@link #findOrderedByPerfumeIds} 는 {@code display_order} 만 보는데 일반 이미지가 1번,
     * 종이 질감이 2번이라 <b>항상 일반 이미지가 뽑힙니다.</b> 종이 질감 화면이 그것을 부르면
     * 배경만 종이인 곳에 투명 배경 사진이 얹힙니다.
     *
     * <p>원하는 종류가 없으면 다른 종류로 넘어갑니다. 156개 향수에만 두 장이 다 있고 나머지는
     * 일반 이미지뿐이라, 없을 때 아무것도 안 주면 그 향수만 빈칸이 됩니다.
     *
     * <p>종류가 같을 때의 순서는 위와 같습니다 — {@code display_order} 가 {@code NULL} 인 행은
     * 뒤로 밀고, 값이 같으면 {@code image_id} 로 확정해 매번 같은 이미지가 뽑히게 합니다.
     */
    @Query("""
            SELECT new com.hyanghae.backend.perfume.repository.PerfumeImageUrl(i.perfume.id, i.imageUrl)
            FROM PerfumeImage i
            WHERE i.perfume.id IN :perfumeIds
            ORDER BY i.perfume.id,
                     CASE WHEN i.imageType = :preferredType THEN 0 ELSE 1 END,
                     i.displayOrder ASC NULLS LAST,
                     i.id
            """)
    List<PerfumeImageUrl> findOrderedByPerfumeIdsPreferring(
            @Param("perfumeIds") Collection<Long> perfumeIds,
            @Param("preferredType") PerfumeImageType preferredType
    );
}
