package com.hyanghae.backend.perfume.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

/**
 * {@code brands} 테이블 매핑입니다.
 *
 * <p>스키마는 Flyway 가 소유하고 {@code ddl-auto} 는 {@code validate} 이므로, 컬럼 이름이나 타입이
 * 어긋나면 애플리케이션이 부팅 단계에서 실패합니다. {@code V1__init_schema.sql} 의 정의와 맞춰야 합니다.
 *
 * <p>접근자가 없는 것은 의도적입니다. 향수 검색과 브랜드 목록이 모두 DTO 프로젝션으로 값을 바로
 * 꺼내므로 자바 코드가 이 엔티티의 필드를 읽지 않습니다. 필요한 기능이 생기면 그때 추가합니다.
 *
 * <p>이름이 두 칸입니다. {@code name} 이 영문, {@code nameKo} 가 한국어입니다. 브랜드 페이지가
 * 두 이름으로 각각 줄을 세울 수 있어야 해서 나눠 두었고, {@code perfumes} 도 같은 방식입니다.
 * 한국어 이름은 아직 채워지지 않아 대부분 비어 있습니다.
 */
@Entity
@Table(name = "brands")
public class Brand {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "brand_id")
    private Long id;

    @Column(name = "name", length = 100)
    private String name;

    @Column(name = "name_ko", length = 100)
    private String nameKo;

    @Column(name = "logo_url", length = 500)
    private String logoUrl;

    @Column(name = "is_active", nullable = false)
    private boolean active;

    protected Brand() {
        // JPA 가 요구하는 기본 생성자입니다.
    }
}
