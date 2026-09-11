package com.hyanghae.backend.collection.dto.response;

import java.time.OffsetDateTime;

public record CollectionSummaryResponse(
        Long collectionId, String name, String description, int perfumeCount,
        OffsetDateTime createdAt, OffsetDateTime updatedAt
) {}
