package com.hyanghae.backend.perfume.dto.response;

import io.swagger.v3.oas.annotations.media.Schema;

/**
 * 노트 한 개입니다. 목록과 상세가 같은 모양을 씁니다.
 *
 * <p>상세에 더 담을 값이 없어서입니다. 설명(description)이 표에 없고, 화면도 이름·대분류·이미지만
 * 그립니다. 나중에 설명이 생기면 상세용 record 를 따로 두면 됩니다.
 *
 * <p>{@code accordFamily} 는 목록을 묶는 기준입니다. <b>향 지도의 향 계열과 다른 어휘입니다</b> —
 * 이쪽은 13가지({@code SWEET}·{@code SPICY}·{@code AROMATIC}·{@code SMOKY}·{@code FRESH}·
 * {@code ETC} 포함)이고 향 계열은 9가지입니다. 노트 원본이 들고 온 값이라 그대로 내보냅니다.
 *
 * <p>{@code popularityRank} 는 향수에 얼마나 자주 쓰이는지의 순위입니다. 1위가 머스크입니다.
 * 비어 있을 수 있어 화면이 정렬에 기대면 안 됩니다 — 목록은 이미 그 순서로 나갑니다.
 */
public record NoteSummaryResponse(

        @Schema(description = "노트 ID", example = "1")
        Long noteId,

        @Schema(description = "영문 이름", example = "Musk")
        String name,

        @Schema(description = "한국어 이름", example = "머스크")
        String nameKo,

        @Schema(description = "대분류. 목록을 묶는 기준입니다. 향 지도의 향 계열과 다른 어휘입니다.",
                example = "MUSK")
        String accordFamily,

        @Schema(description = "노트 이미지 주소. 없을 수 있습니다.")
        String imageUrl,

        @Schema(description = "많이 쓰이는 순위. 비어 있을 수 있습니다.", example = "1")
        Integer popularityRank
) {
}
