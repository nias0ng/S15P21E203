package com.hyanghae.backend.review.dto.response;

import java.time.Instant;
import java.util.List;

public record ReviewResponse(
        Long reviewId,
        String nickname,
        String title,
        String content,
        List<ReviewSeasonResponse> seasons,
        boolean mine,
        Instant createdAt,
        Instant updatedAt
) {
}
