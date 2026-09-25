package com.hyanghae.backend.recommendation.dto.response;

import io.swagger.v3.oas.annotations.media.Schema;
import java.util.List;

/**
 * 추천 이유 한 줄입니다 (요구사항 NLR-07).
 *
 * <p>"내가 쓴 이 말이 이런 향 특성을 가리켜서 이 향수가 나왔다" 를 한 줄로 보여줍니다.
 * 사용자가 <i>"왜 이게 나왔냐"</i> 고 물었을 때 답하는 자리입니다.
 *
 * <p><b>{@code evidence} 와 {@code strengths} 는 짝입니다.</b> 화면이 둘을 순서로 짝지어
 * 그리므로 다음이 지켜져야 합니다.
 *
 * <pre>
 * strengths 의 길이 == evidence 를 ' · ' 로 자른 조각 수
 * strengths[i]       == 그 i 번째 조각의 강도
 * 강도를 모르면        그 자리에 null (배열을 짧게 만들지 않습니다)
 * </pre>
 *
 * <p>이름과 강도를 따로 모으면 한쪽만 걸러졌을 때 길이가 어긋납니다. 그래서
 * {@code NaturalLanguageRecommendationService} 는 둘을 한 record 로 묶어 모으고 마지막에
 * 갈라 담습니다 — 애초에 어긋날 수 없게 두는 편이, 어긋나지 않았는지 검사하는 것보다
 * 안전합니다.
 *
 * <p>숫자를 {@code evidence} 문자열 안에 끼워 넣지 않습니다({@code "woody 100"}). 화면이
 * 그 문자열을 {@code ' · '} 로 자른 뒤 <b>조각마다 한국어 번역표를 찾는데</b>,
 * {@code "woody 100"} 은 표에 없어 영어 그대로 나갑니다. 지금 화면에 <i>우디</i> 가 한국어로
 * 보이는 것은 그 표 덕분입니다.
 *
 * @param phrase    사용자가 쓴 표현입니다. 입력어와 무관한 근거면 {@code null} 입니다.
 * @param evidence  그 표현이 가리키는 향 특성입니다. 여럿이면 {@code ' · '} 로 잇습니다.
 * @param strengths 각 향 특성이 이 향수에 얼마나 있는지입니다(0~100). 위의 짝 규칙을 따릅니다.
 *                  향 조건 없이 성별·계절·낮밤·노트로만 이유를 채운 경우에는 강도라는 것이
 *                  없어 원소가 모두 {@code null} 입니다.
 */
public record RecommendationReasonResponse(

        @Schema(description = "사용자가 쓴 표현입니다. 입력어와 무관한 근거면 null 입니다.",
                example = "빨래", nullable = true)
        String phrase,

        @Schema(description = "그 표현이 가리키는 향 특성입니다. 여럿이면 ' · ' 로 잇습니다.",
                example = "비누 같은 · 산뜻한")
        String evidence,

        @Schema(description = "각 향 특성의 강도입니다(0~100). evidence 를 ' · ' 로 자른 조각과"
                + " 같은 순서 · 같은 개수이고, 모르는 자리는 null 입니다.",
                example = "[100, 93]")
        List<Integer> strengths
) {
}
