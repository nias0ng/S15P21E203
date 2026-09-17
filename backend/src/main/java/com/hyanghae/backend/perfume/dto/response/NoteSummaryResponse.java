package com.hyanghae.backend.perfume.dto.response;

import io.swagger.v3.oas.annotations.media.Schema;

/**
 * 노트 목록의 한 개입니다.
 *
 * <p><b>설명을 담지 않습니다.</b> 목록은 활성 노트 전체를 한 번에 돌려주는 응답이라 설명까지
 * 실으면 크게 무거워지고, 화면도 목록 카드에는 이름과 이미지만 그립니다. 설명이 필요한 상세는
 * {@link NoteDetailResponse} 가 담당합니다.
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
