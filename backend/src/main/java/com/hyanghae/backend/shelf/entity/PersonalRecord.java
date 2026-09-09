package com.hyanghae.backend.shelf.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import java.time.LocalDate;
import java.time.OffsetDateTime;

/**
 * 진열대 향수에 남긴 비공개 시향 기록인 {@code personal_records} 테이블 매핑입니다.
 *
 * <p>한 진열대 항목에 여러 기록을 저장할 수 있는 현재 스키마에 맞춰 다대일 관계로 매핑합니다.
 * 진열대 항목이 삭제되면 데이터베이스의 외래 키 정책에 의해 기록도 함께 삭제됩니다.
 */
@Entity
@Table(name = "personal_records")
public class PersonalRecord {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id")
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_perfume_id")
    private UserPerfume userPerfume;

    @Column(name = "content")
    private String content;

    @Column(name = "tested_at")
    private LocalDate testedAt;

    @Column(name = "created_at")
    private OffsetDateTime createdAt;

    @Column(name = "updated_at")
    private OffsetDateTime updatedAt;

    protected PersonalRecord() {
        // JPA 가 요구하는 기본 생성자입니다.
    }

    public Long getId() {
        return id;
    }

    public UserPerfume getUserPerfume() {
        return userPerfume;
    }

    public String getContent() {
        return content;
    }

    public LocalDate getTestedAt() {
        return testedAt;
    }

    public OffsetDateTime getCreatedAt() {
        return createdAt;
    }

    public OffsetDateTime getUpdatedAt() {
        return updatedAt;
    }
}
