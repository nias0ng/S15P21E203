package com.hyanghae.backend.recommendation.dto.response;

import io.swagger.v3.oas.annotations.media.Schema;

/** 개인화 추천 모달에 표시할 향수 한 건입니다. */
public record PersonalizedPerfumeResponse(

        @Schema(description = "향수 번호입니다.", example = "1234")
        Long perfumeId,

        @Schema(description = "향수 이름입니다. 한국어 이름이 없으면 영어입니다.",
                example = "Lazy Sunday Morning")
        String name,

        @Schema(description = "대표 이미지 주소입니다. 이미지가 없으면 null 입니다.", nullable = true)
        String imageUrl,

        @Schema(description = "실제 추천 점수에 사용한 가장 큰 근거입니다.",
                example = "최근 살펴본 향수에서 자주 만난 바닐라 어코드를 담고 있어요.")
        String reason
) {
}
