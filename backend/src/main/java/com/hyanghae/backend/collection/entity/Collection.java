package com.hyanghae.backend.collection.entity;

import com.hyanghae.backend.shelf.entity.UserPerfume;
import jakarta.persistence.CascadeType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.OneToMany;
import jakarta.persistence.Table;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "collections")
public class Collection {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "collection_id")
    private Long id;

    @Column(name = "user_id")
    private Long userId;

    @Column(name = "name", length = 255)
    private String name;

    @Column(name = "description", length = 500)
    private String description;

    @Column(name = "created_at")
    private OffsetDateTime createdAt;

    @Column(name = "updated_at")
    private OffsetDateTime updatedAt;

    @OneToMany(mappedBy = "collection", cascade = CascadeType.PERSIST)
    private final List<CollectionPerfume> collectionPerfumes = new ArrayList<>();

    protected Collection() {
        // JPA가 요구하는 기본 생성자입니다.
    }

    public static Collection create(
            Long userId,
            String name,
            String description,
            List<UserPerfume> shelfItems,
            OffsetDateTime createdAt
    ) {
        Collection collection = new Collection();
        collection.userId = userId;
        collection.name = name;
        collection.description = description;
        collection.createdAt = createdAt;
        collection.updatedAt = createdAt;

        for (int index = 0; index < shelfItems.size(); index++) {
            collection.collectionPerfumes.add(CollectionPerfume.create(
                    collection,
                    shelfItems.get(index),
                    index,
                    createdAt
            ));
        }
        return collection;
    }

    public Long getId() {
        return id;
    }

    public String getName() {
        return name;
    }

    public String getDescription() {
        return description;
    }

    public OffsetDateTime getCreatedAt() {
        return createdAt;
    }

    public OffsetDateTime getUpdatedAt() {
        return updatedAt;
    }

    public void update(String name, String description, OffsetDateTime updatedAt) {
        this.name = name;
        this.description = description;
        this.updatedAt = updatedAt;
    }

    public void updateModifiedAt(OffsetDateTime updatedAt) {
        this.updatedAt = updatedAt;
    }
}
