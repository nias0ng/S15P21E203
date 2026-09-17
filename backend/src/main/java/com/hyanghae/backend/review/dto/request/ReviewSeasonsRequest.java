package com.hyanghae.backend.review.dto.request;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Size;
import java.util.List;

/**
 * 후기의 계절을 통째로 바꾸는 요청입니다.
 *
 * <p>작성과 같은 이유로 코드를 받습니다 — {@link ReviewCreateRequest} 를 보십시오.
 */
public record ReviewSeasonsRequest(
        @Schema(description = "교체할 계절 코드. 중복 없이 1개 이상 4개 이하",
                example = "[\"AUTUMN\", \"WINTER\"]",
                allowableValues = {"SPRING", "SUMMER", "AUTUMN", "WINTER"})
        @NotEmpty
        @Size(max = 4)
        List<@NotBlank String> seasonCodes
) {
}
