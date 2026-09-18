package com.hyanghae.backend.recommendation.dto.response;

import io.swagger.v3.oas.annotations.media.Schema;
import java.util.List;

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
 * @param recommendationId 이 추천의 번호입니다. 화면이 클릭과 만족도를 보낼 때 씁니다.
 *                 <b>{@code null} 일 수 있습니다</b> — 기록에 실패한 경우이고, 그때는
 *                 클릭·만족도를 보내지 않으면 됩니다. 추천 자체는 정상입니다.
 * @param status   위 네 가지 중 하나입니다.
 * @param query    사용자가 쓴 말 그대로입니다.
 * @param perfumes 0~5개입니다. {@code status} 가 {@code OK} 또는 {@code OK_RELAXED} 면
 *                 비어 있지 않습니다.
 */
public record NaturalLanguageRecommendationResponse(

        @Schema(description = "이 추천의 번호입니다. 클릭과 만족도를 보낼 때 씁니다."
                + " 기록에 실패하면 null 이고, 그때는 보내지 않으면 됩니다.",
                example = "1042", nullable = true)
        Long recommendationId,

        @Schema(description = "결과의 종류입니다. 화면이 네 가지를 구분해야 합니다.",
                allowableValues = {"OK", "OK_RELAXED", "NO_CONDITION", "NO_RESULT"},
                example = "OK")
        String status,

        @Schema(description = "사용자가 쓴 말 그대로입니다.",
                example = "빨래 냄새 나는 향수 찾고 있어")
        String query,

        @Schema(description = "추천된 향수입니다. 0~5개이고, 없으면 빈 배열입니다.")
        List<RecommendedPerfumeResponse> perfumes
) {
}
