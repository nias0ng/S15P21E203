package com.hyanghae.backend.perfume.dto.response;

import io.swagger.v3.oas.annotations.media.Schema;

/**
 * 향수를 구성하는 노트 한 건입니다.
 *
 * <p>{@code noteType} 을 탑·미들·베이스로 미리 나누지 않고 그대로 내려줍니다. 컬럼에 값 제약이
 * 없어 백엔드가 세 칸에 나눠 담으면 예상하지 못한 값이 조용히 버려집니다. 화면이 이 값으로
 * 묶어서 보여줍니다.
 *
 * <p>{@code noteId} 를 포함하는 것은 노트 상세 화면으로 이동할 수 있어야 하기 때문입니다.
 *
 * <p>이름이 둘입니다. 영어 화면은 {@code name} 을, 한국어 화면은 {@code nameKo} 를 적습니다.
 * 한국어 이름이 비어 있으면 화면은 {@code name} 으로 되돌아갑니다.
 */
public record PerfumeNoteResponse(
        @Schema(description = "노트 ID", example = "1")
        Long noteId,

        @Schema(description = "영문 이름", example = "Bergamot")
        String name,

        @Schema(description = "한국어 이름. 비어 있으면 화면은 영문 이름을 적습니다.",
                example = "베르가못", nullable = true)
        String nameKo,

        @Schema(description = "노트 위치. 값 그대로 내려갑니다.", example = "TOP")
        String noteType
) {
}
