package com.hyanghae.backend.community.dto.response;

import io.swagger.v3.oas.annotations.media.Schema;

/**
 * 글에 걸린 향수입니다. 화면은 이 번호로 향수 상세로 넘어갑니다.
 *
 * <p>{@code brand} 가 비어 있을 수 있습니다. 인계 데이터에 브랜드가 없는 향수가 있습니다.
 *
 * <p>이름이 둘씩입니다. 영어 화면은 {@code name} · {@code brand} 를, 한국어 화면은
 * {@code nameKo} · {@code brandKo} 를 적고, 한국어 이름이 비어 있으면 원래 이름으로 되돌아갑니다.
 */
public record PostPerfumeResponse(
        @Schema(description = "향수 ID", example = "1")
        Long perfumeId,

        @Schema(description = "향수 원래(영문) 이름", example = "Bleu de Chanel")
        String name,

        @Schema(description = "향수 한국어 이름. 비어 있으면 화면은 원래 이름을 적습니다.",
                example = "블루 드 샤넬", nullable = true)
        String nameKo,

        @Schema(description = "브랜드 원래(영문) 이름. 인계 데이터에 브랜드가 없는 향수가 있습니다.",
                example = "Chanel", nullable = true)
        String brand,

        @Schema(description = "브랜드 한국어 이름. 비어 있으면 화면은 원래 이름을 적습니다.",
                example = "샤넬", nullable = true)
        String brandKo
) {
}
