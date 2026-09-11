package com.hyanghae.backend.collection.dto.response;

public record CollectionPerfumeResponse(
        Long shelfItemId, Long perfumeId, String name, String brand, String thumbnailUrl
) {
    public CollectionPerfumeResponse(
            Long shelfItemId,
            Long perfumeId,
            String name,
            String brand
    ) {
        this(shelfItemId, perfumeId, name, brand, null);
    }

    public CollectionPerfumeResponse withThumbnailUrl(String thumbnailUrl) {
        return new CollectionPerfumeResponse(
                shelfItemId,
                perfumeId,
                name,
                brand,
                thumbnailUrl
        );
    }
}
