package com.hyanghae.backend.review.dto.response;

import java.util.List;

public record ReviewSeasonsResponse(
        Long reviewId,
        List<Long> seasonIds
) {
}
