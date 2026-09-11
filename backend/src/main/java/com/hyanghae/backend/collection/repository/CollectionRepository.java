package com.hyanghae.backend.collection.repository;

import com.hyanghae.backend.collection.dto.response.CollectionSummaryResponse;
import com.hyanghae.backend.collection.entity.Collection;
import jakarta.persistence.LockModeType;
import java.util.Optional;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface CollectionRepository extends JpaRepository<Collection, Long> {

    Optional<Collection> findByIdAndUserId(Long id, Long userId);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT c FROM Collection c WHERE c.id = :id AND c.userId = :userId")
    Optional<Collection> findByIdAndUserIdForUpdate(
            @Param("id") Long id,
            @Param("userId") Long userId
    );

    @Query(
            value = """
                    SELECT new com.hyanghae.backend.collection.dto.response.CollectionSummaryResponse(
                               c.id,
                               c.name,
                               c.description,
                               CAST(COUNT(cp) AS integer),
                               c.createdAt,
                               c.updatedAt
                           )
                    FROM Collection c
                    LEFT JOIN c.collectionPerfumes cp
                    WHERE c.userId = :userId
                    GROUP BY c.id, c.name, c.description, c.createdAt, c.updatedAt
                    ORDER BY c.id DESC
                    """,
            countQuery = "SELECT COUNT(c) FROM Collection c WHERE c.userId = :userId"
    )
    Page<CollectionSummaryResponse> findPageByUserId(
            @Param("userId") Long userId,
            Pageable pageable
    );
}
