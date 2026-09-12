package com.hyanghae.backend.review.dto.response;

import java.time.Instant;

public record ReviewUpdateResponse(
        Long reviewId,
        String title,
        String content,
        Instant updatedAt
) {
}
