package com.hyanghae.backend.perfumeview.dto.response;

import java.time.Instant;

public record PerfumeViewExitResponse(
        Long perfumeViewId,
        Instant exitedAt,
        Integer durationSeconds
) {
}
