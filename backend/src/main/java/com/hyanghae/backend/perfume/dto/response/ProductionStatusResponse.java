package com.hyanghae.backend.perfume.dto.response;

import io.swagger.v3.oas.annotations.media.Schema;
import java.time.LocalDate;

/**
 * 확인된 생산 상태입니다. 지금은 단종만 담습니다.
 *
 * <p>상태와 함께 확인일과 근거를 줍니다. 향수 상세는 지금 '단종' 만 그리지만, 언제 무엇을 보고
 * 그렇게 판정했는지는 다시 확인하거나 잘못 적힌 것을 고칠 때 필요해 응답에서 빼지 않았습니다.
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
