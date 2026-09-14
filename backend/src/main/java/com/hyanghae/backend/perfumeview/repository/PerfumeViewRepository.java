package com.hyanghae.backend.perfumeview.repository;

import com.hyanghae.backend.perfumeview.entity.PerfumeView;
import jakarta.persistence.LockModeType;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface PerfumeViewRepository extends JpaRepository<PerfumeView, Long> {

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("""
            SELECT pv
            FROM PerfumeView pv
            WHERE pv.id = :perfumeViewId
              AND pv.userId = :userId
            """)
    Optional<PerfumeView> findByIdAndUserIdForUpdate(
            @Param("perfumeViewId") Long perfumeViewId,
            @Param("userId") Long userId
    );
}
