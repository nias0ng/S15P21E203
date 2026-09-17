package com.hyanghae.backend.recommendation.dto.response;

import io.swagger.v3.oas.annotations.media.Schema;

/**
 * 추천 이유 한 줄입니다 (요구사항 NLR-07).
 *
 * <p>"내가 쓴 이 말이 이런 향 특성을 가리켜서 이 향수가 나왔다" 를 한 줄로 보여줍니다.
 * 사용자가 <i>"왜 이게 나왔냐"</i> 고 물었을 때 답하는 자리입니다.
 *
 * @param phrase   사용자가 쓴 표현입니다. 입력어와 무관한 근거면 {@code null} 입니다.
 * @param evidence 그 표현이 가리키는 향 특성입니다. 여럿이면 {@code ' · '} 로 잇습니다.
 */
public record RecommendationReasonResponse(

        @Schema(description = "사용자가 쓴 표현입니다. 입력어와 무관한 근거면 null 입니다.",
                example = "빨래", nullable = true)
        String phrase,

        @Schema(description = "그 표현이 가리키는 향 특성입니다. 여럿이면 ' · ' 로 잇습니다.",
                example = "비누 같은 · 산뜻한")
        String evidence
) {
}
