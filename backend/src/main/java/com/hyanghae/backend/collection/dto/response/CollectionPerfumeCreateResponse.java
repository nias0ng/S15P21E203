package com.hyanghae.backend.collection.dto.response;

import java.time.OffsetDateTime;

public record CollectionPerfumeCreateResponse(
        Long collectionId,
        Long shelfItemId,
        OffsetDateTime createdAt
) {
}
