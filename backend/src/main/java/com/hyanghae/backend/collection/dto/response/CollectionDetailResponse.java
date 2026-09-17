package com.hyanghae.backend.collection.dto.response;

import java.time.OffsetDateTime;
import java.util.List;

public record CollectionDetailResponse(
        Long collectionId, String name, String description,
        List<CollectionPerfumeResponse> perfumes,
        OffsetDateTime createdAt, OffsetDateTime updatedAt
) {}
