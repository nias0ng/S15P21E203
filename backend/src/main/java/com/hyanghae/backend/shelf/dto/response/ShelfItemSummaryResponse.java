package com.hyanghae.backend.shelf.dto.response;

import com.hyanghae.backend.shelf.entity.OwnershipStatus;
import io.swagger.v3.oas.annotations.media.Schema;
import java.math.BigDecimal;

public record ShelfItemSummaryResponse(
        @Schema(description = "사용자 진열대 항목 ID", example = "157")
        Long shelfItemId,

        @Schema(description = "향수 ID", example = "1")
        Long perfumeId,

        @Schema(description = "향수명", example = "Bleu de Chanel")
        String name,

        @Schema(description = "향수 보유 상태", example = "OWNED")
        OwnershipStatus ownershipStatus,

        @Schema(description = "취향 적합도", example = "4.5", nullable = true)
        BigDecimal fitRating,

        @Schema(description = "대표 향수 여부", example = "true")
        boolean representative
) {
}
