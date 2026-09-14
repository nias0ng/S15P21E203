package com.hyanghae.backend.collection.dto.response;

import java.util.List;

public record CollectionsResponse(
        List<CollectionSummaryResponse> collections, int page, int size, long totalElements
) {}
