package com.hyanghae.backend.collection.repository;

import com.hyanghae.backend.collection.dto.response.CollectionPerfumeResponse;
import com.hyanghae.backend.collection.entity.CollectionPerfume;
import com.hyanghae.backend.collection.entity.CollectionPerfumeId;
import java.util.Collection;
import jakarta.persistence.LockModeType;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface CollectionPerfumeRepository
        extends JpaRepository<CollectionPerfume, CollectionPerfumeId> {

    @Query("""
            SELECT CASE WHEN COUNT(cp) > 0 THEN true ELSE false END
            FROM CollectionPerfume cp
            WHERE cp.collection.id = :collectionId
              AND cp.shelfItem.id = :shelfItemId
            """)
    boolean existsByCollectionIdAndShelfItemId(
            @Param("collectionId") Long collectionId,
            @Param("shelfItemId") Long shelfItemId
    );

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("""
            SELECT cp
            FROM CollectionPerfume cp
            WHERE cp.collection.id = :collectionId
              AND cp.shelfItem.id = :shelfItemId
            """)
    Optional<CollectionPerfume> findByCollectionIdAndShelfItemIdForUpdate(
            @Param("collectionId") Long collectionId,
            @Param("shelfItemId") Long shelfItemId
    );

    @Query("""
            SELECT COUNT(cp)
            FROM CollectionPerfume cp
            WHERE cp.collection.id = :collectionId
            """)
    long countByCollectionId(@Param("collectionId") Long collectionId);

    @Query("""
            SELECT MAX(cp.displayOrder)
            FROM CollectionPerfume cp
            WHERE cp.collection.id = :collectionId
            """)
    Integer findMaxDisplayOrderByCollectionId(@Param("collectionId") Long collectionId);

    @Query("""
            SELECT new com.hyanghae.backend.collection.dto.response.CollectionPerfumeResponse(
                       up.id,
                       p.id,
                       p.name,
                       p.nameKo,
                       b.name
                   )
            FROM CollectionPerfume cp
            JOIN cp.shelfItem up
            JOIN up.perfume p
            LEFT JOIN p.brand b
            WHERE cp.collection.id = :collectionId
            ORDER BY cp.displayOrder ASC NULLS LAST, up.id
            """)
    List<CollectionPerfumeResponse> findAllByCollectionId(
            @Param("collectionId") Long collectionId
    );

    /**
     * 주어진 컬렉션들에 담긴 향수를 담긴 순서대로 조회합니다.
     *
     * <p>목록의 미리보기 사진을 채우는 데 씁니다. 컬렉션마다 따로 부르면 한 페이지에 쿼리가
     * 컬렉션 수만큼 나가므로 <b>한 번에</b> 읽습니다.
     *
     * <p>컬렉션당 앞의 몇 건만 필요하지만 여기서 자르지 않습니다. JPQL 에는 그룹별로 개수를
     * 제한하는 방법이 없고, 돌아오는 것이 번호 두 개짜리 행이라 부르는 쪽에서 자르는 편이
     * 간단합니다.
     *
     * <p>정렬은 상세 조회와 같습니다. 같은 컬렉션의 미리보기와 상세가 다른 순서로 보이면
     * 화면이 어긋납니다.
     */
    @Query("""
            SELECT new com.hyanghae.backend.collection.repository.CollectionPerfumeRow(
                       cp.collection.id,
                       p.id
                   )
            FROM CollectionPerfume cp
            JOIN cp.shelfItem up
            JOIN up.perfume p
            WHERE cp.collection.id IN :collectionIds
            ORDER BY cp.collection.id, cp.displayOrder ASC NULLS LAST, up.id
            """)
    List<CollectionPerfumeRow> findAllByCollectionIds(
            @Param("collectionIds") Collection<Long> collectionIds
    );
}
