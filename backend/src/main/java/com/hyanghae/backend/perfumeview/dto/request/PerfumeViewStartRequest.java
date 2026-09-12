package com.hyanghae.backend.perfumeview.dto.request;

import com.hyanghae.backend.perfumeview.entity.PerfumeViewSourceType;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;

public record PerfumeViewStartRequest(
        @Schema(description = "조회한 향수 ID")
        @NotNull
        @Positive
        Long perfumeId,

        @Schema(description = "향수 상세 화면 유입 경로")
        @NotNull
        PerfumeViewSourceType fromLocationType,

        @Schema(description = "다른 향수 상세에서 이동한 경우 이전 향수 ID", nullable = true)
        @Positive
        Long fromPerfumeId
) {
}
