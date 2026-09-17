package com.hyanghae.backend.perfume.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

/** {@code seasons} 테이블 매핑입니다. 계절의 마스터 데이터입니다. */
@Entity
@Table(name = "seasons")
public class Season {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "season_id")
    private Long id;

    @Column(name = "code", length = 30)
    private String code;

    @Column(name = "name", length = 100)
    private String name;

    @Column(name = "is_active", nullable = false)
    private boolean active;

    protected Season() {
        // JPA 가 요구하는 기본 생성자입니다.
    }

    /**
     * 후기가 계절 코드를 번호로 바꿀 때 씁니다.
     *
     * <p>게터가 둘뿐인 이유는 지금까지 이 엔티티를 개수만 세는 데 썼기 때문입니다. 필요해진 것만
     * 엽니다.
     */
    public Long getId() {
        return id;
    }

    public String getCode() {
        return code;
    }
}
