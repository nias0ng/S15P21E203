package com.hyanghae.backend.shelf.repository;

import com.hyanghae.backend.shelf.entity.Memo;
import jakarta.persistence.LockModeType;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

/** 개인 메모의 데이터 접근 진입점입니다. */
public interface MemoRepository extends JpaRepository<Memo, Long> {

    Optional<Memo> findByUserPerfumeId(Long shelfItemId);

    @Query("""
            SELECT memo
            FROM Memo memo
            JOIN FETCH memo.userPerfume up
            WHERE up.id = :shelfItemId
              AND up.userId = :userId
            """)
    Optional<Memo> findByShelfItemIdAndUserId(
            @Param("shelfItemId") Long shelfItemId,
            @Param("userId") Long userId
    );

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("""
            SELECT memo
            FROM Memo memo
            JOIN FETCH memo.userPerfume up
            WHERE up.id = :shelfItemId
              AND up.userId = :userId
            """)
    Optional<Memo> findByShelfItemIdAndUserIdForUpdate(
            @Param("shelfItemId") Long shelfItemId,
            @Param("userId") Long userId
    );
}
