package com.hyanghae.backend.perfume.dto.response;

import io.swagger.v3.oas.annotations.media.Schema;

/**
 * 향수 상세 화면의 후기 집계 네 가지를 한 번에 내려줍니다.
 *
 * <p>네 조각은 각각 {@code review-summary} · {@code review-keywords} ·
 * {@code review-statistics} · {@code season-statistics} 가 내려주던 응답 <b>그대로</b>입니다.
 * 새 모양을 만들지 않은 이유가 있습니다. 화면이 옮겨올 때 읽는 위치만 한 단계 깊어지고 필드
 * 이름과 의미는 하나도 바뀌지 않아야, 옮기다 값이 어긋나는 일이 없습니다. 각 조각의 규칙
 * — 백분율의 분모, 계절 네 칸을 항상 채우는 것, 요약이 없으면 필드가 모두 null 인 것 —
 * 은 전부 해당 레코드의 설명에 그대로 남아 있습니다.
 *
 * <p><b>왜 합쳤는가.</b> 상세 화면 한 장이 이 넷을 동시에 부릅니다. 나누어 두면 화면 한 장이
 * HTTP 4건 · 트랜잭션 4건이 되고, 그 안에서 향수 존재 확인({@code existsByIdAndActiveTrue})
 * 이 같은 값으로 네 번 실행됩니다. 부하 테스트에서 이 화면만 10 VU 에서 처리량이 포화하고
 * p95 가 다른 API 의 3배로 튄 것이 그 때문입니다. 합치면 존재 확인이 한 번이고 트랜잭션도
 * 하나입니다.
 *
 * <p>없는 향수와 비활성 향수는 404 입니다. 집계가 비어 있는 것과 향수가 없는 것은 다른
 * 상황이라 구분해야 합니다. 존재하는 향수인데 집계가 없으면 각 조각이 각자의 빈 값
 * (빈 배열, 0, null)으로 내려갑니다.
 */
@Schema(description = "향수 상세 화면의 후기 집계 네 가지를 한 번에 내려줍니다.")
public record PerfumeReviewAggregatesResponse(
        @Schema(description = "AI 후기 요약입니다. 요약이 아직 없으면 세 필드가 모두 null 입니다.")
        PerfumeReviewSummaryResponse reviewSummary,

        @Schema(description = "후기 키워드 통계입니다. size 로 요청한 개수까지만 담습니다.")
        PerfumeReviewKeywordsResponse reviewKeywords,

        @Schema(description = "후기 수입니다.")
        PerfumeReviewStatisticsResponse reviewStatistics,

        @Schema(description = "계절 통계입니다. 계절 네 개가 항상 들어 있습니다.")
        PerfumeSeasonStatisticsResponse seasonStatistics
) {
}
