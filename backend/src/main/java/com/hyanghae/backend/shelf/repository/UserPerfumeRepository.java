package com.hyanghae.backend.shelf.repository;

import com.hyanghae.backend.shelf.dto.response.ShelfItemDetailResponse;
import com.hyanghae.backend.shelf.dto.response.ShelfItemSummaryResponse;
import com.hyanghae.backend.shelf.entity.OwnershipStatus;
import com.hyanghae.backend.shelf.entity.UserPerfume;
import jakarta.persistence.LockModeType;
import java.util.List;
import java.util.Optional;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

/** 진열대 항목의 데이터 접근 진입점입니다. 기능별 조회 메서드는 실제 조회 요구와 함께 추가합니다. */
public interface UserPerfumeRepository extends JpaRepository<UserPerfume, Long> {

    boolean existsByUserIdAndPerfumeId(Long userId, Long perfumeId);

    @Query(
            value = """
                    SELECT new com.hyanghae.backend.shelf.dto.response.ShelfItemSummaryResponse(
                               up.id,
                               p.id,
                               p.name,
                               b.name,
                               up.ownershipStatus,
                               CASE WHEN up.representative = true THEN true ELSE false END
                           )
                    FROM UserPerfume up
                    JOIN up.perfume p
                    LEFT JOIN p.brand b
                    WHERE up.userId = :userId
                      AND up.ownershipStatus = :category
                    """,
            countQuery = """
                    SELECT COUNT(up)
                    FROM UserPerfume up
                    WHERE up.userId = :userId
                      AND up.ownershipStatus = :category
                    """
    )
    Page<ShelfItemSummaryResponse> findPageByUserIdAndCategory(
            @Param("userId") Long userId,
            @Param("category") OwnershipStatus category,
            Pageable pageable
    );

    @Query("""
            SELECT new com.hyanghae.backend.shelf.dto.response.ShelfItemDetailResponse(
                       up.id,
                       p.id,
                       p.name,
                       p.nameKo,
                       b.name,
                       up.ownershipStatus,
                       up.fitRating,
                       CASE WHEN up.representative = true THEN true ELSE false END
                   )
            FROM UserPerfume up
            JOIN up.perfume p
            LEFT JOIN p.brand b
            WHERE up.id = :id
              AND up.userId = :userId
            """)
    Optional<ShelfItemDetailResponse> findDetailByIdAndUserId(
            @Param("id") Long id,
            @Param("userId") Long userId
    );

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT up FROM UserPerfume up WHERE up.id = :id AND up.userId = :userId")
    Optional<UserPerfume> findByIdAndUserIdForUpdate(
            @Param("id") Long id,
            @Param("userId") Long userId
    );

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT up FROM UserPerfume up WHERE up.userId = :userId ORDER BY up.id")
    List<UserPerfume> findAllByUserIdForUpdate(@Param("userId") Long userId);
}
