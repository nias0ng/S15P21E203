package com.hyanghae.backend.review.dto.response;

import io.swagger.v3.oas.annotations.media.Schema;
import java.time.Instant;
import java.util.List;

/**
 * 고치고 난 뒤의 후기입니다.
 *
 * <p><b>보낸 항목이 아니라 고쳐진 결과를 담습니다.</b> 제목만 보냈어도 내용과 계절이 함께
 * 나갑니다. 화면이 이 응답만으로 캐시를 갱신할 수 있어야 하기 때문입니다 — 일부만 돌려주면
 * 화면은 나머지를 알 수 없어 상세를 다시 불러야 합니다.
 */
public record ReviewUpdateResponse(
        @Schema(description = "후기 ID", example = "12")
        Long reviewId,

        @Schema(description = "고쳐진 제목")
        String title,

        @Schema(description = "고쳐진 내용")
        String content,

        @Schema(description = "고쳐진 계절 코드", example = "[\"AUTUMN\", \"WINTER\"]")
        List<String> seasonCodes,

        @Schema(description = "고친 시각")
        Instant updatedAt
) {
}
