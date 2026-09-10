package com.hyanghae.backend.shelf.dto.request;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotNull;

public record RepresentativeRequest(
        @Schema(description = "대표 향수 지정 여부", example = "true")
        @NotNull
        Boolean representative
) {
}
