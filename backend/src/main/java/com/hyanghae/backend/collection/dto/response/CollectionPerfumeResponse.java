package com.hyanghae.backend.collection.dto.response;

import io.swagger.v3.oas.annotations.media.Schema;

/**
 * 컬렉션에 담긴 향수입니다.
 *
 * <p>이름이 둘입니다. 카드가 한국어 이름을 적기 때문입니다. 진열대 목록
 * ({@code ShelfItemSummaryResponse})과 같은 순서로 맞췄습니다 — 같은 향수가 화면마다 다른
 * 모양으로 오면 옮겨 쓸 때 헷갈립니다.
 *
 * <p>브랜드는 영문 그대로입니다.
 */
public record CollectionPerfumeResponse(
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
        String thumbnailUrl
) {

    /** 목록 쿼리가 사용합니다. 이미지는 페이지에 포함된 향수만 별도로 조회합니다. */
    public CollectionPerfumeResponse(
            Long shelfItemId,
            Long perfumeId,
            String name,
            String nameKo,
            String brand
    ) {
        this(shelfItemId, perfumeId, name, nameKo, brand, null);
    }

    public CollectionPerfumeResponse withThumbnailUrl(String thumbnailUrl) {
        return new CollectionPerfumeResponse(
                shelfItemId,
                perfumeId,
                name,
                nameKo,
                brand,
                thumbnailUrl
        );
    }
}
