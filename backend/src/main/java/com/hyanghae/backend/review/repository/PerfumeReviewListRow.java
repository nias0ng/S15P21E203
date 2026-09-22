package com.hyanghae.backend.review.repository;

import java.time.Instant;

public interface PerfumeReviewListRow {

    Long getReviewId();

    String getNickname();

    /** 작성자가 탈퇴했거나 사진을 설정하지 않았으면 비어 있습니다. */
    String getProfileImageUrl();

    String getTitle();

    String getContent();

    boolean getMine();

    Instant getCreatedAt();

    Instant getUpdatedAt();
}
