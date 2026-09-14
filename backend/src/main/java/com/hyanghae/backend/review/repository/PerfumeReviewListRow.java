package com.hyanghae.backend.review.repository;

import java.time.Instant;

public interface PerfumeReviewListRow {

    Long getReviewId();

    String getNickname();

    String getTitle();

    String getContent();

    boolean getMine();

    Instant getCreatedAt();

    Instant getUpdatedAt();
}
