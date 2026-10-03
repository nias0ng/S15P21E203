package com.hyanghae.backend.recommendation.dto.response;

import io.swagger.v3.oas.annotations.media.Schema;

/**
 * 개인화 추천 모달에 표시할 향수 한 건입니다.
 *
 * <p>{@code name} 과 {@code reason} 까지는 예전 모양 그대로입니다. 뒤의 네 필드는 영어 화면이
 * 이름과 근거를 스스로 고를 수 있게 더한 것입니다.
 */
public record PersonalizedPerfumeResponse(

        @Schema(description = "향수 번호입니다.", example = "1234")
        Long perfumeId,

        @Schema(description = "향수 이름입니다. 한국어 이름이 없으면 영어입니다.",
                example = "Lazy Sunday Morning")
        String name,

        @Schema(description = "대표 이미지 주소입니다. 이미지가 없으면 null 입니다.", nullable = true)
        String imageUrl,

        @Schema(description = "실제 추천 점수에 사용한 가장 큰 근거를 풀어 쓴 문장입니다. "
                + "요청 언어(Accept-Language)가 영어면 영어 문장입니다.",
                example = "최근 살펴본 향수에서 자주 만난 vanilla 어코드를 담고 있어요.")
        String reason,

        @Schema(description = "향수의 원래 이름(perfumes.name)입니다.",
                example = "Lazy Sunday Morning")
        String originalName,

        @Schema(description = "향수의 한국어 이름입니다. 없으면 null 입니다.",
                example = "레이지 선데이 모닝", nullable = true)
        String nameKo,

        @Schema(description = "reason 의 근거가 나온 곳입니다. FIT 는 높게 평가한 향수, "
                + "RECENT 는 최근 살펴본 향수, TASTE_TEST 는 취향 테스트입니다.",
                allowableValues = {"FIT", "RECENT", "TASTE_TEST"}, example = "RECENT")
        String evidenceSource,

        @Schema(description = "근거를 언어와 상관없이 가리키는 값입니다. FIT · RECENT 면 어코드의 "
                + "영어 이름 그대로, TASTE_TEST 면 향 계열 code(scent_regions.code)입니다.",
                example = "vanilla")
        String evidenceKey
) {
}
