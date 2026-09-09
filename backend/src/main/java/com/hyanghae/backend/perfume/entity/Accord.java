package com.hyanghae.backend.perfume.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

/** {@code accords} 테이블 매핑입니다. 향수가 주는 인상을 묶은 어코드의 마스터 데이터입니다. */
@Entity
@Table(name = "accords")
public class Accord {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "accord_id")
    private Long id;

    @Column(name = "name", length = 100)
    private String name;

    @Column(name = "is_active", nullable = false)
    private boolean active;

    protected Accord() {
        // JPA 가 요구하는 기본 생성자입니다.
    }
}
