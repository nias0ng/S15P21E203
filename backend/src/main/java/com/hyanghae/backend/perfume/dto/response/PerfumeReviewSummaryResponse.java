package com.hyanghae.backend.perfume.dto.response;

import io.swagger.v3.oas.annotations.media.Schema;
import java.time.Instant;

/**
 * AI 가 생성한 후기 요약입니다.
 *
 * <p>요약이 아직 없는 향수는 세 필드가 모두 {@code null} 인 200 응답입니다. 404 를 쓰지 않는
 * 이유는 "향수가 없다" 와 구분되지 않기 때문입니다. 없는 향수는 {@code PERFUME_NOT_FOUND} 로
 * 404 를 반환합니다.
 *
 * <p>요약은 후기 요약 배치가 적재합니다. 후기가 최소 개수만큼 쌓이기 전인 향수는 빈 응답입니다.
 *
 * <p>{@code sourceReviewCount} 는 요약을 만들 때 사용한 후기 수입니다. 후기 통계의
 * {@code reviewCount} 와 비교하면 요약이 최신인지 화면에서 판단할 수 있습니다.
 *
 * <p>영어 요청({@code Accept-Language: en})이면 {@code summary} 만 영어로 바뀝니다. 한국어 요약을
 * 옮긴 것이라 {@code sourceReviewCount} · {@code updatedAt} 은 한국어 요약의 값 그대로입니다.
 */
@Schema(description = "AI 후기 요약입니다. 요약이 아직 없으면 세 필드가 모두 null 입니다.")
public record PerfumeReviewSummaryResponse(
        @Schema(description = "요약 본문입니다. 줄바꿈(\\n)으로 나뉘며 첫 줄이 총평, 그다음이 \"· 주제: \" 로"
                + " 시작하는 주제별 한 줄입니다. Accept-Language: en 이면 한국어 요약을 옮긴 영어이고,"
                + " 옮기지 못하면(번역 꺼짐 · 실패 · 시간 초과) 한국어 그대로입니다.",
                example = "시트러스로 시작해 우디로 정착한다는 평이 많습니다.\n· 지속력: 짧다는 의견이 있습니다.",
                nullable = true)
        String summary,

        @Schema(description = "요약을 만들 때 쓴 후기 수입니다. 언어와 관계없이 한국어 요약의 값입니다.",
                example = "42", nullable = true)
        Integer sourceReviewCount,

        @Schema(description = "한국어 요약을 마지막으로 만든 시각입니다. 영어 응답에서도 번역 시각이 아니라"
                + " 이 값입니다.", example = "2026-09-05T09:00:00Z", nullable = true)
        Instant updatedAt
) {

    /** 요약이 없는 향수의 응답입니다. */
    public static PerfumeReviewSummaryResponse empty() {
        return new PerfumeReviewSummaryResponse(null, null, null);
    }
}
