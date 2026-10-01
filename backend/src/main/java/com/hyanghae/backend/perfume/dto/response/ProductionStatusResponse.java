package com.hyanghae.backend.perfume.dto.response;

import io.swagger.v3.oas.annotations.media.Schema;
import java.time.LocalDate;

/**
 * 확인된 생산 상태입니다. 지금은 단종만 담습니다.
 *
 * <p>상태만 주지 않고 확인일과 근거를 함께 줍니다. 화면이 '단종' 옆에 언제 무엇을 보고 그렇게
 * 판정했는지 보여 줘야, 아직 파는 향수를 잘못 적었을 때 사용자가 알아채고 알려 줄 수 있습니다.
 */
public record ProductionStatusResponse(
        @Schema(description = "생산 상태. 지금은 DISCONTINUED 만 옵니다.", example = "DISCONTINUED")
        String status,

        @Schema(description = "확인한 날", example = "2026-10-01")
        LocalDate checkedAt,

        @Schema(description = "판정 근거 URL", example = "https://www.bulgari.com/")
        String source
) {

    /** 단종이 아니면(모르면) {@code null} 입니다. 응답에서 칸이 비어 있는 것과 같습니다. */
    public static ProductionStatusResponse of(String status, LocalDate checkedAt, String source) {
        return status == null ? null : new ProductionStatusResponse(status, checkedAt, source);
    }
}
