package com.hyanghae.backend.perfumeview.dto.response;

import java.time.Instant;

public record PerfumeViewStartResponse(
        Long perfumeViewId,
        Instant viewedAt
) {
}
