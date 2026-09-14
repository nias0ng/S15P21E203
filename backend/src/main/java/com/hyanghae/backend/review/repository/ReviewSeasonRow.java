package com.hyanghae.backend.review.repository;

public record ReviewSeasonRow(
        Long reviewId,
        Long seasonId,
        String code,
        String name
) {
}
