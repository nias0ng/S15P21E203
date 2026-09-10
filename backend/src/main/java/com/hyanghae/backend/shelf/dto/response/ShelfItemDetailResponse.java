package com.hyanghae.backend.shelf.dto.response;

import com.hyanghae.backend.perfume.dto.response.PerfumeNoteResponse;
import com.hyanghae.backend.shelf.entity.OwnershipStatus;
import io.swagger.v3.oas.annotations.media.Schema;
import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.List;

public record ShelfItemDetailResponse(
        @Schema(description = "사용자 진열대 항목 ID", example = "157")
        Long shelfItemId,

        @Schema(description = "향수 ID", example = "1")
        Long perfumeId,

        @Schema(description = "향수 영문명", example = "Coco Mademoiselle")
        String name,

        @Schema(description = "향수 한국명", example = "코코 마드모아젤", nullable = true)
        String nameKo,

        @Schema(description = "브랜드명", example = "Chanel", nullable = true)
        String brand,

        @Schema(description = "대표 이미지 URL", nullable = true)
        String thumbnailUrl,

        @Schema(description = "진열대 분류", example = "OWNED")
        OwnershipStatus category,

        @Schema(description = "취향 적합도", example = "4.5", nullable = true)
        BigDecimal rating,

        @Schema(description = "대표 향수 여부", example = "true")
        boolean representative,

        @Schema(description = "향수의 향조 목록")
        List<PerfumeNoteResponse> scentNotes,

        @Schema(description = "개인 메모", nullable = true)
        String memo,

        @Schema(description = "메모 수정 시각", nullable = true)
        OffsetDateTime memoUpdatedAt
) {

    /** 기본 상세 쿼리가 사용합니다. 이미지·향조·메모는 서비스에서 조합합니다. */
    public ShelfItemDetailResponse(
            Long shelfItemId,
            Long perfumeId,
            String name,
            String nameKo,
            String brand,
            OwnershipStatus category,
            BigDecimal rating,
            boolean representative
    ) {
        this(
                shelfItemId,
                perfumeId,
                name,
                nameKo,
                brand,
                null,
                category,
                rating,
                representative,
                List.of(),
                null,
                null
        );
    }

    public ShelfItemDetailResponse withDetails(
            String thumbnailUrl,
            List<PerfumeNoteResponse> scentNotes,
            String memo,
            OffsetDateTime memoUpdatedAt
    ) {
        return new ShelfItemDetailResponse(
                shelfItemId,
                perfumeId,
                name,
                nameKo,
                brand,
                thumbnailUrl,
                category,
                rating,
                representative,
                List.copyOf(scentNotes),
                memo,
                memoUpdatedAt
        );
    }
}
