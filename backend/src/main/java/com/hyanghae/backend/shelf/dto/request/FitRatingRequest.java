package com.hyanghae.backend.shelf.dto.request;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;
import java.math.BigDecimal;

public record FitRatingRequest(
        @Schema(description = "향수 취향 적합도", example = "4.5", minimum = "1.0", maximum = "5.0")
        @NotNull
        @DecimalMin("1.0")
        @DecimalMax("5.0")
        BigDecimal fitRating
) {
}
