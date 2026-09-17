package com.hyanghae.backend.collection.dto.response;

import io.swagger.v3.oas.annotations.media.Schema;
import java.time.OffsetDateTime;
import java.util.List;

/**
 * 컬렉션 목록의 한 줄입니다.
 *
 * <p>{@code previewThumbnails} 는 카드에 미리 보여줄 향수 사진입니다. 목록에 실어 주지 않으면
 * 화면이 컬렉션마다 상세를 한 번씩 더 불러야 합니다 — 컬렉션이 스무 개면 요청이 스무 건
 * 늘어납니다.
 */
public record CollectionSummaryResponse(
        @Schema(description = "컬렉션 ID", example = "9")
        Long collectionId,

        @Schema(description = "컬렉션 이름", example = "봄에 어울리는")
        String name,

        @Schema(description = "설명", nullable = true)
        String description,

        @Schema(description = "담긴 향수 수", example = "5")
        int perfumeCount,

        @Schema(description = "미리보기 사진. 담긴 순서대로 최대 3장입니다. 사진이 없는 향수는"
                + " 자리를 지키기 위해 null 로 담기고, 담긴 향수가 3개 미만이면 배열이 짧습니다."
                + " 아무것도 담기지 않은 컬렉션은 빈 배열입니다.")
        List<String> previewThumbnails,

        @Schema(description = "만든 시각")
        OffsetDateTime createdAt,

        @Schema(description = "마지막으로 고친 시각")
        OffsetDateTime updatedAt
) {

    /**
     * 목록 쿼리가 쓰는 생성자입니다. JPQL 생성자 표현식은 목록을 만들 수 없으므로 미리보기는
     * 비워 두고, 페이지에 포함된 컬렉션만 {@link #withPreviewThumbnails(List)} 로 채웁니다.
     */
    public CollectionSummaryResponse(
            Long collectionId,
            String name,
            String description,
            int perfumeCount,
            OffsetDateTime createdAt,
            OffsetDateTime updatedAt
    ) {
        this(collectionId, name, description, perfumeCount, List.of(), createdAt, updatedAt);
    }

    public CollectionSummaryResponse withPreviewThumbnails(List<String> previewThumbnails) {
        return new CollectionSummaryResponse(
                collectionId,
                name,
                description,
                perfumeCount,
                previewThumbnails,
                createdAt,
                updatedAt
        );
    }
}
