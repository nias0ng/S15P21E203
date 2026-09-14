package com.hyanghae.backend.shelf.dto.request;

import com.hyanghae.backend.shelf.entity.OwnershipStatus;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;

public record ShelfItemCreateRequest(
        @Schema(description = "저장할 향수 ID", example = "1")
        @NotNull
        @Positive
        Long perfumeId,

        @Schema(
                description = "향수 보유 상태. 생략하면 WISH로 저장됩니다.",
                example = "WISH",
                allowableValues = {"OWNED", "TRIED", "WISH"},
                defaultValue = "WISH"
        )
        OwnershipStatus ownershipStatus
) {
}
