package com.hyanghae.backend.collection.repository;

import com.hyanghae.backend.collection.dto.response.CollectionSummaryResponse;
import com.hyanghae.backend.collection.entity.Collection;
import jakarta.persistence.LockModeType;
import java.util.List;
import java.util.Optional;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface CollectionRepository extends JpaRepository<Collection, Long> {

    Optional<Collection> findByIdAndUserId(Long id, Long userId);

    /**
     * 컬렉션에 담긴 향수 번호입니다. 화면에 놓인 순서 그대로입니다.
     *
     * <p>컬렉션 공유 글이 글을 쓸 때 이 목록을 복사해 갑니다. 컬렉션은 진열대 항목
     * ({@code user_perfumes})을 담고 있어 향수 번호까지 한 칸 더 타고 들어갑니다.
     *
     * <p>복사하는 이유는 글이 그때의 컬렉션을 박제해야 하기 때문입니다. 진열대 항목은 회원이
     * 탈퇴하면 함께 사라지지만, 복사해 둔 향수 번호는 마스터를 가리켜 살아남습니다.
     */
    @Query("""
            SELECT cp.shelfItem.perfume.id
            FROM CollectionPerfume cp
            WHERE cp.collection.id = :collectionId
            ORDER BY cp.displayOrder NULLS LAST, cp.shelfItem.id
            """)
    List<Long> findPerfumeIds(@Param("collectionId") Long collectionId);

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
