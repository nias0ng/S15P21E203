package com.hyanghae.backend.recommendation.dto.response;

import io.swagger.v3.oas.annotations.media.Schema;

/**
 * 향이 아닌 추천 근거 하나입니다 — 성별 · 계절 · 낮밤 · 노트로 후보를 좁혔을 때 옵니다.
 *
 * <p><b>추천 5개에 똑같이 걸린 조건이라 향수마다가 아니라 최상위에 한 번 옵니다.</b> 목록 위에
 * <i>"중성적인 향수 중에서 골랐어요"</i> 한 줄로 쓰는 자리입니다.
 *
 * <p><b>이 목록이 비어 있지 않은데 {@code perfumes[].reasons} 에 향 근거가 없으면 "향으로 고른
 * 것이 아니다" 라는 뜻입니다.</b> 그때 순서를 정한 것은 평가자 수입니다. 화면이
 * <i>"중성적인 향수를 찾았어요"</i> 처럼 향을 보고 고른 것처럼 쓰면 거짓말이 됩니다.
 *
 * @param field 근거의 종류입니다. 화면이 성별과 노트를 다르게 보여줘야 하면 이 값으로 가릅니다.
 * @param label 화면에 그대로 쓸 한국어입니다. AI 가 한국어로 주므로 {@code matched[].accord}
 *              와 달리 우리가 번역하지 않습니다.
 */
public record RecommendationDataResponse(

        @Schema(description = "근거의 종류입니다.",
                allowableValues = {"gender", "season", "daypart", "note"}, example = "gender")
        String field,

        @Schema(description = "화면에 그대로 쓸 한국어입니다.", example = "중성적인")
        String label
) {
}
