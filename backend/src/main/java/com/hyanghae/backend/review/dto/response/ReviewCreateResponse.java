package com.hyanghae.backend.review.dto.response;

import java.time.Instant;
import java.util.List;

public record ReviewCreateResponse(
        Long reviewId,
        String title,
        String content,
        List<Long> seasonIds,
        Instant createdAt
) {
}
