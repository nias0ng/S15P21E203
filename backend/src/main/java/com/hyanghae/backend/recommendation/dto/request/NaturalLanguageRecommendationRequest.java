package com.hyanghae.backend.recommendation.dto.request;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * 자연어 추천 요청입니다.
 *
 * <p>칸이 하나뿐입니다. 로그인 여부가 결과에 영향을 주지 않으므로 사용자를 가리키는 값이
 * 없습니다. 비회원도 그대로 부를 수 있습니다.
 *
 * <p>{@code @Size} 의 {@code min} 은 검증에는 필요 없습니다 — {@code @NotBlank} 가 이미
 * 빈 값을 막습니다. 적어 두는 이유는 <b>Swagger 문서 때문</b>입니다. 없으면 생성된 스키마가
 * {@code minLength: 0} 이 되어, 실제로는 거절하는 값을 문서가 허용한다고 말하게 됩니다.
 *
 * @param query 사용자가 쓴 문장입니다. 1~500자입니다.
 */
public record NaturalLanguageRecommendationRequest(

        @Schema(description = "찾고 싶은 향을 한국어 문장으로 씁니다.",
                example = "빨래 냄새 나는 향수 찾고 있어",
                requiredMode = Schema.RequiredMode.REQUIRED,
                minLength = 1, maxLength = 500)
        @NotBlank
        @Size(min = 1, max = 500)
        String query
) {
}
