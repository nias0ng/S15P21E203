package com.hyanghae.backend.perfume.dto.response;

import io.swagger.v3.oas.annotations.media.Schema;

/**
 * 노트 하나의 상세입니다.
 *
 * <p>목록({@link NoteSummaryResponse})과 달리 <b>설명을 담습니다.</b> 목록은 활성 노트 전체를
 * 한 번에 돌려주는 응답이라 설명까지 실으면 크게 무거워집니다. 화면도 목록 카드에는 이름과
 * 이미지만 그립니다.
 *
 * <p>{@code accordFamily} 는 목록을 묶는 기준입니다. <b>향 지도의 향 계열과 다른 어휘입니다</b> —
 * 이쪽은 13가지이고 향 계열은 9가지입니다. 노트 원본이 들고 온 값이라 그대로 내보냅니다.
 */
public record NoteDetailResponse(

        @Schema(description = "노트 ID", example = "1")
        Long noteId,

        @Schema(description = "영문 이름", example = "Musk")
        String name,

        @Schema(description = "한국어 이름", example = "머스크")
        String nameKo,

        @Schema(description = "대분류. 향 지도의 향 계열과 다른 어휘입니다.", example = "MUSK")
        String accordFamily,

        @Schema(description = "노트 이미지 주소. 없을 수 있습니다.", nullable = true)
        String imageUrl,

        @Schema(description = "많이 쓰이는 순위. 비어 있을 수 있습니다.", example = "1",
                nullable = true)
        Integer popularityRank,

        @Schema(description = "노트 설명. 요청 언어(Accept-Language)를 따릅니다 — en 이면 영어"
                + " 설명이고, 영어 설명이 없는 노트는 한국어 설명으로 되돌아갑니다. 그 밖의 언어나"
                + " 헤더가 없으면 한국어 설명입니다. 채워지는 대로 들어오므로 비어 있을 수 있고,"
                + " 그때 화면은 설명 영역을 그리지 않습니다.",
                example = "포근하고 관능적인 잔향으로, 향수의 베이스를 오래 붙잡아 둡니다.",
                nullable = true)
        String description
) {
}
