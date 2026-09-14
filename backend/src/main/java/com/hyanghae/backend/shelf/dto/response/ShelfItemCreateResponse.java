package com.hyanghae.backend.shelf.dto.response;

import com.hyanghae.backend.shelf.entity.OwnershipStatus;
import com.hyanghae.backend.shelf.entity.UserPerfume;
import io.swagger.v3.oas.annotations.media.Schema;
import java.time.OffsetDateTime;

public record ShelfItemCreateResponse(
        @Schema(description = "사용자 진열대 항목 ID", example = "156")
        Long shelfItemId,

        @Schema(description = "향수 ID", example = "1")
        Long perfumeId,

        @Schema(description = "향수 보유 상태", example = "WISH")
        OwnershipStatus ownershipStatus,

        @Schema(description = "저장 시각")
        OffsetDateTime createdAt
) {

    public static ShelfItemCreateResponse from(UserPerfume shelfItem, Long perfumeId) {
        return new ShelfItemCreateResponse(
                shelfItem.getId(),
                perfumeId,
                shelfItem.getOwnershipStatus(),
                shelfItem.getCreatedAt()
        );
    }
}
