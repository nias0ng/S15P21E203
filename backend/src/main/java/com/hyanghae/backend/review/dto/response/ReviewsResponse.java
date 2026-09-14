package com.hyanghae.backend.review.dto.response;

import java.util.List;

public record ReviewsResponse(
        List<ReviewResponse> reviews,
        int page,
        int size,
        long totalElements
) {
}
