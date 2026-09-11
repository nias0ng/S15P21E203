package com.hyanghae.backend.collection.repository;

import com.hyanghae.backend.collection.dto.response.CollectionPerfumeResponse;
import com.hyanghae.backend.collection.entity.CollectionPerfume;
import com.hyanghae.backend.collection.entity.CollectionPerfumeId;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface CollectionPerfumeRepository
        extends JpaRepository<CollectionPerfume, CollectionPerfumeId> {

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
