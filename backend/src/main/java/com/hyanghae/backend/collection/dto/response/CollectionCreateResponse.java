package com.hyanghae.backend.collection.dto.response;

import java.time.OffsetDateTime;

public record CollectionCreateResponse(
        Long collectionId, String name, String description, OffsetDateTime createdAt
) {}
