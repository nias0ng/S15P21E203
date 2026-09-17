package com.hyanghae.backend.shelf.dto.response;

import com.hyanghae.backend.shelf.entity.OwnershipStatus;
import io.swagger.v3.oas.annotations.media.Schema;

/**
 * 진열대 목록의 한 항목입니다.
 *
 * <p>이름이 둘입니다. 진열대 벽의 이름표가 <b>한국어</b>로 적히기 때문입니다. 상세
 * ({@link ShelfItemDetailResponse})가 같은 순서로 둘 다 담고 있어 모양을 맞췄습니다.
 *
 * <p>브랜드는 영문 그대로입니다. 이름표가 브랜드를 영문으로 적습니다.
 */
public record ShelfItemSummaryResponse(
        @Schema(description = "사용자 진열대 항목 ID", example = "157")
        Long shelfItemId,

        @Schema(description = "향수 ID", example = "1")
        Long perfumeId,

        @Schema(description = "향수 영문명", example = "Bleu de Chanel")
        String name,

        @Schema(description = "향수 한국명. 아직 채워지지 않은 향수가 있고, 그때 화면은 영문명을"
                + " 그대로 적습니다.", example = "블루 드 샤넬", nullable = true)
        String nameKo,

        @Schema(description = "브랜드명", example = "Chanel", nullable = true)
        String brand,

        @Schema(description = "대표 이미지 URL", nullable = true)
        String thumbnailUrl,

        @Schema(description = "진열대 분류", example = "OWNED")
        OwnershipStatus category,

        @Schema(description = "대표 향수 여부", example = "true")
        boolean representative
) {

    /** 기본 목록 쿼리가 사용합니다. 이미지와 메모는 페이지에 포함된 항목만 별도로 조회합니다. */
    public ShelfItemSummaryResponse(
            Long shelfItemId,
            Long perfumeId,
            String name,
            String nameKo,
            String brand,
            OwnershipStatus category,
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
                representative
        );
    }

    public ShelfItemSummaryResponse withThumbnailUrl(String thumbnailUrl) {
        return new ShelfItemSummaryResponse(
                shelfItemId,
                perfumeId,
                name,
                nameKo,
                brand,
                thumbnailUrl,
                category,
                representative
        );
    }
}
