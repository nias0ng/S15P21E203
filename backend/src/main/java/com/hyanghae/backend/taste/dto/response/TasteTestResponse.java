package com.hyanghae.backend.taste.dto.response;

import io.swagger.v3.oas.annotations.media.Schema;
import java.time.OffsetDateTime;
import java.util.List;

/**
 * 취향 테스트 기록입니다. 저장한 직후와 조회에 같은 모양을 씁니다.
 *
 * <p>아직 치르지 않은 사용자는 {@code completed} 가 {@code false} 이고 나머지가 비어 있는 200
 * 응답입니다. 404 로 하면 화면이 "처음 온 사용자" 를 오류로 다뤄야 합니다. 배 자리 조회
 * ({@code GET /api/v1/map/exploration/me}) 가 같은 이유로 같은 형태를 씁니다.
 *
 * <p>좌표를 함께 담습니다. 화면이 이 응답만으로 배를 그릴 수 있어야 왕복이 한 번으로 끝납니다.
 *
 * <p>{@code matchedPerfumeId} 가 비어 있는데 {@code completed} 가 {@code true} 일 수 있습니다.
 * 지도를 다시 만들면서 그 향수가 지도에서 빠진 경우입니다. 고른 계열은 남아 있으므로 화면은
 * {@code picks} 로 다시 고르면 됩니다.
 */
public record TasteTestResponse(

        @Schema(description = "테스트를 마쳤는지", example = "true")
        boolean completed,

        @Schema(description = "고른 향 계열 코드. 순서가 순위입니다.",
                example = "[\"FLORAL\", \"WOODY\"]")
        List<String> picks,

        @Schema(description = "결과 향수. 배의 첫 자리입니다.", example = "42")
        Long matchedPerfumeId,

        @Schema(description = "결과 향수의 지도 x 좌표. 0~1 입니다.", example = "0.09163")
        Double x,

        @Schema(description = "결과 향수의 지도 y 좌표. 0~0.83056 입니다.", example = "0.04484")
        Double y,

        @Schema(description = "테스트를 마친 시각")
        OffsetDateTime completedAt
) {

    /** 아직 치르지 않은 사용자의 응답입니다. */
    public static TasteTestResponse notCompleted() {
        return new TasteTestResponse(false, List.of(), null, null, null, null);
    }
}
