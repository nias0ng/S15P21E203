package com.hyanghae.backend.perfume.dto.response;

import io.swagger.v3.oas.annotations.media.Schema;

/**
 * 브랜드 한 곳의 상세입니다.
 *
 * <p>목록({@link BrandSummaryResponse})과 달리 <b>향수 수를 담습니다.</b> 목록에서 뺀 이유는
 * 크기였습니다 — 브랜드가 7,793개라 필드 하나가 133KB 입니다. 한 건에는 그 사정이 없습니다.
 *
 * <p>{@code nameKo} 와 {@code logoUrl} 은 비어 있을 수 있습니다. 한국어 이름과 로고가 아직
 * 채워지지 않은 브랜드가 많습니다.
 */
public record BrandDetailResponse(
        @Schema(description = "브랜드 ID", example = "1")
        Long brandId,

        @Schema(description = "영문 이름", example = "Jo Malone London")
        String name,

        @Schema(description = "한국어 이름. 아직 채워지지 않은 브랜드가 많습니다.",
                example = "조 말론 런던", nullable = true)
        String nameKo,

        @Schema(description = "로고 이미지 주소. 없으면 화면이 자리표시자를 그립니다.",
                nullable = true)
        String logoUrl,

        @Schema(description = "이 브랜드의 활성 향수 수", example = "42")
        int perfumeCount
) {
}
