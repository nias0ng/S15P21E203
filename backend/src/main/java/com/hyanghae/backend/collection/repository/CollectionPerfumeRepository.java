package com.hyanghae.backend.collection.repository;

import com.hyanghae.backend.collection.dto.response.CollectionPerfumeResponse;
import com.hyanghae.backend.collection.entity.CollectionPerfume;
import com.hyanghae.backend.collection.entity.CollectionPerfumeId;
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
}
