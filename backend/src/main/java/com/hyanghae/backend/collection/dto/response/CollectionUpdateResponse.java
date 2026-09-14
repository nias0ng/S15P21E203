package com.hyanghae.backend.collection.dto.response;

import java.time.OffsetDateTime;

public record CollectionUpdateResponse(
        Long collectionId, String name, String description, OffsetDateTime updatedAt
) {}
