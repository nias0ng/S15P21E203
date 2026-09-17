package com.hyanghae.backend.shelf.dto.response;

import io.swagger.v3.oas.annotations.media.Schema;
import java.util.List;
import org.springframework.data.domain.Page;

public record ShelfItemsResponse(
        @Schema(description = "진열대에 저장한 향수 목록")
        List<ShelfItemSummaryResponse> perfumes,

        @Schema(description = "현재 페이지 번호", example = "0")
        int page,

        @Schema(description = "페이지 크기", example = "7")
        int size,

        @Schema(description = "선택한 분류의 전체 진열대 항목 수", example = "10")
        long totalElements
) {

    public static ShelfItemsResponse from(Page<ShelfItemSummaryResponse> page) {
        return new ShelfItemsResponse(
                page.getContent(),
                page.getNumber(),
                page.getSize(),
                page.getTotalElements()
        );
    }
}
