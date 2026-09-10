package com.hyanghae.backend.shelf.repository;

import com.hyanghae.backend.shelf.entity.PersonalRecord;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

/** 개인 시향 기록의 데이터 접근 진입점입니다. 기능별 조회 메서드는 실제 조회 요구와 함께 추가합니다. */
public interface PersonalRecordRepository extends JpaRepository<PersonalRecord, Long> {

    Optional<PersonalRecord> findByUserPerfumeId(Long shelfItemId);
}
