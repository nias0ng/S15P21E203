package com.hyanghae.backend.collection.entity;

import java.io.Serializable;
import java.util.Objects;

public class CollectionPerfumeId implements Serializable {

    private Long collection;
    private Long shelfItem;

    public CollectionPerfumeId() {
        // JPA가 요구하는 기본 생성자입니다.
    }

    @Override
    public boolean equals(Object other) {
        if (this == other) {
            return true;
        }
        if (!(other instanceof CollectionPerfumeId that)) {
            return false;
        }
        return Objects.equals(collection, that.collection)
                && Objects.equals(shelfItem, that.shelfItem);
    }

    @Override
    public int hashCode() {
        return Objects.hash(collection, shelfItem);
    }
}
