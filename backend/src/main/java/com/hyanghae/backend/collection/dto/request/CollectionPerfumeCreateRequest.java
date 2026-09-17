package com.hyanghae.backend.collection.dto.request;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;

public record CollectionPerfumeCreateRequest(
        @Schema(description = "컬렉션에 추가할 내 진열대 항목 ID", example = "1")
        @NotNull
        @Positive
        Long shelfItemId
) {
}
