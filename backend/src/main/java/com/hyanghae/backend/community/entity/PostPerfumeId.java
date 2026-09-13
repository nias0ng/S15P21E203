package com.hyanghae.backend.community.entity;

import java.io.Serializable;
import java.util.Objects;

/** {@link PostPerfume} 의 복합키입니다. 한 글에 같은 향수를 두 번 걸 수 없습니다. */
public class PostPerfumeId implements Serializable {

    private Long post;
    private Long perfume;

    public PostPerfumeId() {
        // JPA 가 요구하는 기본 생성자입니다.
    }

    @Override
    public boolean equals(Object other) {
        if (this == other) {
            return true;
        }
        if (!(other instanceof PostPerfumeId that)) {
            return false;
        }
        return Objects.equals(post, that.post) && Objects.equals(perfume, that.perfume);
    }

    @Override
    public int hashCode() {
        return Objects.hash(post, perfume);
    }
}
