package com.hyanghae.backend.collection.dto.request;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.*;
import java.util.List;

public record CollectionCreateRequest(
        @Schema(description = "컬렉션 이름, 사용자별 중복 불가", maxLength = 50)
        @NotBlank
        @Size(max = 50)
        String name,

        @Schema(description = "설명", maxLength = 300, nullable = true)
        @Size(max = 300)
        String description,

        @Schema(description = "최초로 포함할 내 진열대 항목 ID. 중복 없이 최소 1개")
        @NotEmpty
        List<@NotNull @Positive Long> shelfItemIds
) {
}
