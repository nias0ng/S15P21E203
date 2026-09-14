package com.hyanghae.backend.community.dto.response;

import java.util.List;

/** 게시글 목록 한 페이지입니다. */
public record PostsResponse(
        List<PostSummaryResponse> posts,
        int page,
        int size,
        long totalElements
) {
}
