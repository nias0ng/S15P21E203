package com.hyanghae.backend.review.dto.request;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;
import java.util.List;

public record ReviewSeasonsRequest(
        @Schema(description = "교체할 계절 ID. 중복 없이 1개 이상 4개 이하")
        @NotEmpty
        @Size(max = 4)
        List<@NotNull @Positive Long> seasonIds
) {
}
