package com.hyanghae.backend.review.dto.response;

import io.swagger.v3.oas.annotations.media.Schema;

/**
 * 후기가 매달린 향수입니다.
 *
 * <p>후기 게시판은 여러 향수의 후기가 섞여 나오므로 줄마다 어느 향수 이야기인지 보여야 합니다.
 * 와이어프레임 A22a 가 "향수 블록이 없는 후기는 없다" 고 적어 둔 자리입니다.
 *
 * <p>{@code brand} 는 비어 있을 수 있습니다. 브랜드가 없는 향수가 있습니다.
 *
 * <p>이름이 둘씩입니다. 영어 화면은 {@code name} · {@code brand} 를, 한국어 화면은
 * {@code nameKo} · {@code brandKo} 를 적고, 한국어 이름이 비어 있으면 원래 이름으로 되돌아갑니다.
 */
public record ReviewPerfumeResponse(
        @Schema(description = "향수 ID", example = "1")
        Long perfumeId,

        @Schema(description = "향수 원래(영문) 이름", example = "Bleu de Chanel")
        String name,

        @Schema(description = "향수 한국어 이름. 비어 있으면 화면은 원래 이름을 적습니다.",
                example = "블루 드 샤넬", nullable = true)
        String nameKo,

        @Schema(description = "브랜드 원래(영문) 이름. 브랜드가 없는 향수가 있습니다.",
                example = "Chanel", nullable = true)
        String brand,

        @Schema(description = "브랜드 한국어 이름. 비어 있으면 화면은 원래 이름을 적습니다.",
                example = "샤넬", nullable = true)
        String brandKo
) {
}
