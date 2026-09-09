package com.hyanghae.backend.shelf.entity;

import com.hyanghae.backend.perfume.entity.Perfume;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import java.math.BigDecimal;
import java.time.OffsetDateTime;

/**
 * 사용자가 진열대에 저장한 향수를 나타내는 {@code user_perfumes} 테이블 매핑입니다.
 *
 * <p>사용자 도메인이 아직 구현되지 않아 {@code user_id}는 식별자 값으로 매핑합니다. 향수는 이미
 * 엔티티가 존재하므로 지연 로딩 연관관계를 사용합니다.
 *
 * <p>진열대 해제는 이 엔티티를 물리 삭제합니다. 연결된 시향 기록과 컬렉션 항목은 데이터베이스의
 * 외래 키 정책에 따라 함께 삭제됩니다. 대표 향수 변경 등 상태 변경 로직은 후속 기능에서 서비스
 * 트랜잭션과 함께 구현합니다.
 */
@Entity
@Table(name = "user_perfumes")
public class UserPerfume {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "user_perfumes_id")
    private Long id;

    @Column(name = "user_id")
    private Long userId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "perfume_id")
    private Perfume perfume;

    @Enumerated(EnumType.STRING)
    @Column(name = "ownership_status", length = 30)
    private OwnershipStatus ownershipStatus;

    @Column(name = "fit_rating", precision = 2, scale = 1)
    private BigDecimal fitRating;

    @Column(name = "is_representative")
    private Boolean representative;

    @Column(name = "created_at")
    private OffsetDateTime createdAt;

    @Column(name = "updated_at")
    private OffsetDateTime updatedAt;

    protected UserPerfume() {
        // JPA 가 요구하는 기본 생성자입니다.
    }

    public Long getId() {
        return id;
    }

    public Long getUserId() {
        return userId;
    }

    public Perfume getPerfume() {
        return perfume;
    }

    public OwnershipStatus getOwnershipStatus() {
        return ownershipStatus;
    }

    public BigDecimal getFitRating() {
        return fitRating;
    }

    public Boolean getRepresentative() {
        return representative;
    }

    public OffsetDateTime getCreatedAt() {
        return createdAt;
    }

    public OffsetDateTime getUpdatedAt() {
        return updatedAt;
    }

}
