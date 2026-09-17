package com.hyanghae.backend.review.dto.response;

import io.swagger.v3.oas.annotations.media.Schema;
import java.util.List;

/** 계절을 바꾼 뒤의 후기입니다. 요청과 같은 말(코드)을 돌려줍니다. */
public record ReviewSeasonsResponse(
        Long reviewId,

        @Schema(description = "저장된 계절 코드", example = "[\"AUTUMN\", \"WINTER\"]")
        List<String> seasonCodes
) {
}
