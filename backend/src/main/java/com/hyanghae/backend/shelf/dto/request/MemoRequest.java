package com.hyanghae.backend.shelf.dto.request;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;

public record MemoRequest(
        @Schema(description = "메모 내용", example = "비 오는 날 잔향이 오래 남는다.")
        @NotBlank(message = "메모 내용을 입력해야 합니다.")
        String content
) {
}
