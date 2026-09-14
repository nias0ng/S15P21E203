package com.hyanghae.backend.perfume.dto.response;

import io.swagger.v3.oas.annotations.media.Schema;

/**
 * 브랜드 페이지에 한 장으로 나오는 브랜드입니다.
 *
 * <p>{@code name} 이 영문, {@code nameKo} 가 한국어입니다. 카드에 무엇을 크게 보여줄지는 화면이
 * 정합니다. 서버는 둘 다 보냅니다.
 *
 * <p>{@code nameKo} 는 비어 있을 수 있습니다. 71개 브랜드의 한국어 이름이 아직 채워지지
 * 않았습니다. 그런 브랜드는 한국어 이름순에서 뒤로 밀립니다.
 *
 * <p>{@code logoUrl} 도 비어 있을 수 있습니다. 화면이 "로고" 자리표시자를 대신 그립니다.
 *
 * <p>{@code perfumeCount} 는 <b>활성 향수</b>만 셉니다. 내려간 향수는 목록에도 상세에도 나오지
 * 않으므로, 세어서 보여주면 눌러 들어갔을 때 수가 맞지 않습니다.
 */
public record BrandSummaryResponse(
        Long brandId,

        @Schema(description = "영문 이름", example = "Jo Malone London")
        String name,

        @Schema(description = "한국어 이름. 아직 채워지지 않은 브랜드가 많습니다.",
                example = "조 말론 런던", nullable = true)
        String nameKo,

        @Schema(description = "로고 이미지 주소. 없으면 화면이 자리표시자를 그립니다.",
                nullable = true)
        String logoUrl,

        @Schema(description = "이 브랜드의 활성 향수 수", example = "9")
        long perfumeCount
) {
}
