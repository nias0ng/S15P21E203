package com.hyanghae.backend.perfume.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

/**
 * {@code review_keywords} 테이블 매핑입니다. AI 가 후기에서 뽑은 향 표현의 어휘입니다.
 *
 * <p>이름에 유니크 제약이 있습니다. 추출 단계가 "달콤한"을 만날 때마다 같은 행을 쓰게 하고,
 * 적재를 다시 돌려도 어휘가 늘어나지 않게 합니다. 비슷한 표현을 하나로 묶는 일도 추출 단계가
 * 같은 이름으로 정규화해 주는 것으로 처리됩니다.
 *
 * <p>어휘는 지우지 않습니다. 어떤 후기에도 붙지 않게 된 이름이 남을 수 있는데, 통계는 후기와
 * 이어진 행만 세므로 화면에 나타나지 않습니다.
 */
@Entity
@Table(name = "review_keywords")
public class ReviewKeyword {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "keyword_id")
    private Long id;

    @Column(name = "name", length = 50)
    private String name;

    protected ReviewKeyword() {
        // JPA 가 요구하는 기본 생성자입니다.
    }

    private ReviewKeyword(String name) {
        this.name = name;
    }

    /** 어휘에 없던 이름을 새로 만듭니다. 이름 정규화는 부르는 쪽에서 끝내고 옵니다. */
    public static ReviewKeyword of(String name) {
        return new ReviewKeyword(name);
    }

    public Long id() {
        return id;
    }

    public String name() {
        return name;
    }
}
