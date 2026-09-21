package com.hyanghae.backend.recommendation.dto.response;

import io.swagger.v3.oas.annotations.media.Schema;
import java.util.List;
import java.util.UUID;

/**
 * 자연어 추천 응답입니다.
 *
 * <p><b>{@code status} 네 가지를 화면이 구분해야 합니다.</b> 향수가 0개인 경우가 두 종류이고
 * 사용자에게 할 말이 서로 다릅니다.
 *
 * <table border="1">
 *   <caption>{@code status} 네 가지</caption>
 *   <tr><th>값</th><th>뜻</th><th>화면에서</th></tr>
 *   <tr><td>{@code OK}</td><td>조건을 전부 만족하는 향수를 찾음</td><td>그대로 보여줍니다</td></tr>
 *   <tr><td>{@code OK_RELAXED}</td><td>조건을 넓혔거나 향 조건이 하나뿐이라 순위를 못 정함</td>
 *       <td>"조건이 넓습니다" 를 함께 보여주고 더 자세한 입력을 유도합니다</td></tr>
 *   <tr><td>{@code NO_CONDITION}</td><td>향 조건을 하나도 못 뽑음</td>
 *       <td>다시 입력하도록 유도합니다</td></tr>
 *   <tr><td>{@code NO_RESULT}</td><td>조건은 찾았으나 보여줄 향수가 없음</td>
 *       <td>다시 입력하도록 유도합니다</td></tr>
 * </table>
 *
 * <p><b>{@code NO_CONDITION} 일 때 인기 향수를 대신 보여주면 안 됩니다.</b> 추천처럼 보이지만
 * 근거가 없습니다. <i>"왜 이게 나왔냐"</i> 에 답할 수 없고 요구사항 NLR-07(추천 이유 제공)을
 * 어깁니다. 드문 경우도 아닙니다 — 합성 평가셋 600건에서 22.3%, 실사용자 설문 155건에서
 * 48.4% 입니다. 예외가 아니라 정상 경로입니다.
 *
 * @param recommendationToken 이 추천의 손잡이입니다. 화면이 클릭과 만족도를 보낼 때 씁니다.
 *                 <b>번호가 아니라 추측할 수 없는 값입니다</b> — 순차 번호를 내보내면 아무나
 *                 남의 추천에 만족도를 남기고 클릭을 채울 수 있습니다. 로그인을 요구하지 않고
 *                 위조만 막으려는 것이라, 이 값을 받은 사람이 곧 그 추천의 주인입니다.
 *                 <b>{@code null} 일 수 있습니다</b> — 기록에 실패한 경우이고, 그때는
 *                 클릭·만족도를 보내지 않으면 됩니다. 추천 자체는 정상입니다.
 * @param status   위 네 가지 중 하나입니다.
 * @param query    사용자가 쓴 말 그대로입니다.
 * @param pickedWithoutScentCondition 향으로 고른 것이 아닙니다. <b>화면이 이것으로 분기합니다.</b>
 *                 향 조건을 하나도 못 뽑았는데 성별·계절·낮밤·노트로 후보를 좁힐 수는 있었던
 *                 경우이고, 그때 순서를 정한 것은 <b>평가자 수</b>입니다. 화면이
 *                 <i>"중성적인 향수를 찾았어요"</i> 처럼 향을 보고 고른 것처럼 쓰면 거짓말이
 *                 됩니다. <b>{@code status} 로는 알 수 없습니다</b> — 이때도
 *                 {@code OK_RELAXED} 라 조건을 넓힌 경우와 같은 값입니다.
 * @param matchedData 향이 아닌 근거입니다. 성별·계절·낮밤·노트로 후보를 좁혔을 때만 찹니다.
 *                 <b>추천 다섯 개에 똑같이 걸린 조건이라 목록 위 한 줄로 쓰는 자리입니다</b> —
 *                 향수마다 붙는 {@code perfumes[].reasons} 와 다릅니다. 조건을 안 걸었으면
 *                 빈 배열입니다.
 * @param perfumes 0~5개입니다. {@code status} 가 {@code OK} 또는 {@code OK_RELAXED} 면
 *                 비어 있지 않습니다.
 */
public record NaturalLanguageRecommendationResponse(

        @Schema(description = "이 추천의 손잡이입니다. 클릭과 만족도를 보낼 때 그대로"
                + " 돌려보내십시오. 기록에 실패하면 null 이고, 그때는 보내지 않으면 됩니다.",
                example = "b7f3a1e8-4c2d-4f1a-9e3b-2a5c8d7e6f40", nullable = true)
        UUID recommendationToken,

        @Schema(description = "결과의 종류입니다. 화면이 네 가지를 구분해야 합니다.",
                allowableValues = {"OK", "OK_RELAXED", "NO_CONDITION", "NO_RESULT"},
                example = "OK")
        String status,

        @Schema(description = "사용자가 쓴 말 그대로입니다.",
                example = "빨래 냄새 나는 향수 찾고 있어")
        String query,

        @Schema(description = "향으로 고른 것이 아닙니다. 성별 · 계절 · 낮밤 · 노트로만 좁혔고"
                + " 순서는 평가자 수가 정했습니다. 화면이 향을 보고 고른 것처럼 쓰면 거짓말이"
                + " 됩니다. status 로는 알 수 없습니다 — 이때도 OK_RELAXED 입니다.",
                example = "false")
        boolean pickedWithoutScentCondition,

        @Schema(description = "향이 아닌 근거입니다. 성별 · 계절 · 낮밤 · 노트로 고른 경우에만"
                + " 찹니다. 추천 다섯 개에 똑같이 걸린 조건이라 목록 위 한 줄로 쓰는 자리입니다."
                + " 조건을 안 걸었으면 빈 배열입니다.")
        List<RecommendationDataResponse> matchedData,

        @Schema(description = "추천된 향수입니다. 0~5개이고, 없으면 빈 배열입니다.")
        List<RecommendedPerfumeResponse> perfumes
) {
}
