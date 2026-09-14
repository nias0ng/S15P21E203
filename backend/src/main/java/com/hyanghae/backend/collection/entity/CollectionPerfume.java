package com.hyanghae.backend.collection.entity;

import com.hyanghae.backend.shelf.entity.UserPerfume;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.Id;
import jakarta.persistence.IdClass;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import java.time.OffsetDateTime;

@Entity
@Table(name = "collection_perfumes")
@IdClass(CollectionPerfumeId.class)
public class CollectionPerfume {

    @Id
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "collection_id", nullable = false)
    private Collection collection;

    @Id
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_perfume_id", nullable = false)
    private UserPerfume shelfItem;

    @Column(name = "display_order")
    private Integer displayOrder;

    @Column(name = "created_at")
    private OffsetDateTime createdAt;

    protected CollectionPerfume() {
        // JPA가 요구하는 기본 생성자입니다.
    }

    public static CollectionPerfume create(
            Collection collection,
            UserPerfume shelfItem,
            Integer displayOrder,
            OffsetDateTime createdAt
    ) {
        CollectionPerfume collectionPerfume = new CollectionPerfume();
        collectionPerfume.collection = collection;
        collectionPerfume.shelfItem = shelfItem;
        collectionPerfume.displayOrder = displayOrder;
        collectionPerfume.createdAt = createdAt;
        return collectionPerfume;
    }
}
