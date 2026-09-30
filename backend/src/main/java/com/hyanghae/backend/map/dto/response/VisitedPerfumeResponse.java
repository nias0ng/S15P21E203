package com.hyanghae.backend.map.dto.response;

import io.swagger.v3.oas.annotations.media.Schema;

/**
 * 한 번의 구역 진입 동안 배가 들른 향수입니다.
 *
 * <p>이름이 둘입니다. 영어 화면은 {@code name} 을, 한국어 화면은 {@code nameKo} 를 적고, 한국어
 * 이름이 비어 있으면 원래 이름으로 되돌아갑니다.
 */
public record VisitedPerfumeResponse(
        @Schema(description = "향수 ID", example = "1")
        Long perfumeId,

        @Schema(description = "향수 원래(영문) 이름", example = "Bleu de Chanel")
        String name,

        @Schema(description = "향수 한국어 이름. 비어 있으면 화면은 원래 이름을 적습니다.",
                example = "블루 드 샤넬", nullable = true)
        String nameKo
) {
}
