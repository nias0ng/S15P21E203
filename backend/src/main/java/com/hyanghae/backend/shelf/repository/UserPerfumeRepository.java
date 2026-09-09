package com.hyanghae.backend.shelf.repository;

import com.hyanghae.backend.shelf.entity.UserPerfume;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

/** 진열대 항목의 데이터 접근 진입점입니다. 기능별 조회 메서드는 실제 조회 요구와 함께 추가합니다. */
public interface UserPerfumeRepository extends JpaRepository<UserPerfume, Long> {

    Optional<UserPerfume> findByIdAndUserId(Long id, Long userId);
}
