package com.hyanghae.backend.perfume.repository;

/**
 * 노트 상세 조회 결과입니다. 한국어 설명과 영어 설명을 함께 읽습니다.
 *
 * <p>어느 설명을 내보낼지는 요청 언어에 따라 {@code NoteService} 가 고릅니다. 둘 다 비어 있을 수
 * 있습니다.
 */
public record NoteDetailRow(
        Long noteId,
        String name,
        String nameKo,
        String accordFamily,
        String imageUrl,
        Integer popularityRank,
        String description,
        String descriptionEn
) {
}
