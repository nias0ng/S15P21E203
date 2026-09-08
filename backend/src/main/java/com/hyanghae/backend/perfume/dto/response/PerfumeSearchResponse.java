package com.hyanghae.backend.perfume.dto.response;

import java.util.List;
import org.springframework.data.domain.Page;

/**
 * 향수 검색 응답입니다.
 *
 * <p>공용 {@code PageResponse<T>} 를 쓰지 않는 이유가 있습니다. API 명세가 목록 필드에 도메인
 * 이름을 쓰도록 정해서(검색은 {@code perfumes}, 관련 게시글은 {@code posts}) 목록 필드명이
 * {@code content} 로 고정된 제네릭 응답으로는 표현할 수 없습니다. 명세에 {@code totalPages} 도
 * 없어 함께 제외했습니다.
 */
public record PerfumeSearchResponse(
        List<PerfumeSummaryResponse> perfumes,
        int page,
        int size,
        long totalElements
) {

    public static PerfumeSearchResponse from(Page<PerfumeSummaryResponse> page) {
        return new PerfumeSearchResponse(
                page.getContent(),
                page.getNumber(),
                page.getSize(),
                page.getTotalElements()
        );
    }
}
