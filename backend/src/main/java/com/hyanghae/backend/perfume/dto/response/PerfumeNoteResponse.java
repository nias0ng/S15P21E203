package com.hyanghae.backend.perfume.dto.response;

/**
 * 향수를 구성하는 노트 한 건입니다.
 *
 * <p>{@code noteType} 을 탑·미들·베이스로 미리 나누지 않고 그대로 내려줍니다. 컬럼에 값 제약이
 * 없어 백엔드가 세 칸에 나눠 담으면 예상하지 못한 값이 조용히 버려집니다. 화면이 이 값으로
 * 묶어서 보여줍니다.
 *
 * <p>{@code noteId} 를 포함하는 것은 노트 상세 화면으로 이동할 수 있어야 하기 때문입니다.
 */
public record PerfumeNoteResponse(Long noteId, String name, String noteType) {
}
