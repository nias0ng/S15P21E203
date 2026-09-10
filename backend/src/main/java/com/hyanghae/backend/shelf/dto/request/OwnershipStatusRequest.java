package com.hyanghae.backend.shelf.dto.request;

import com.hyanghae.backend.shelf.entity.OwnershipStatus;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotNull;

public record OwnershipStatusRequest(
        @Schema(
                description = "향수 보유 상태",
                example = "OWNED",
                allowableValues = {"OWNED", "TRIED", "WISH"}
        )
        @NotNull
        OwnershipStatus ownershipStatus
) {
}
