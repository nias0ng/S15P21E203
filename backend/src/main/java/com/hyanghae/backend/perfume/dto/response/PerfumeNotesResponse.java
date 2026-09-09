package com.hyanghae.backend.perfume.dto.response;

import java.util.List;

/**
 * 향수 향조 조회 응답입니다.
 *
 * <p>향조 정보가 없는 향수는 두 목록이 빈 배열입니다. 404 를 쓰지 않는 이유는 "향수가 없다" 와
 * 구분되지 않기 때문입니다. 없는 향수는 {@code PERFUME_NOT_FOUND} 로 404 를 반환합니다.
 */
public record PerfumeNotesResponse(
        List<PerfumeNoteResponse> notes,
        List<PerfumeAccordResponse> accords
) {
}
