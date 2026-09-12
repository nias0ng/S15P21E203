package com.hyanghae.backend.review.dto.request;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;
import java.util.List;

public record ReviewCreateRequest(
        @Schema(description = "후기 제목", maxLength = 50)
        @NotBlank
        @Size(max = 50)
        String title,

        @Schema(description = "후기 내용", minLength = 10, maxLength = 1000)
        @NotBlank
        @Size(min = 10, max = 1000)
        String content,

        @Schema(description = "선택한 계절 ID. 중복 없이 1개 이상 4개 이하")
        @NotEmpty
        @Size(max = 4)
        List<@NotNull @Positive Long> seasonIds
) {

    public ReviewCreateRequest {
        title = title == null ? null : title.strip();
        content = content == null ? null : content.strip();
    }
}
