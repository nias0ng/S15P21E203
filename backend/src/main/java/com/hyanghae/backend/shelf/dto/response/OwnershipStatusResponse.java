package com.hyanghae.backend.shelf.dto.response;

import com.hyanghae.backend.shelf.entity.OwnershipStatus;
import com.hyanghae.backend.shelf.entity.UserPerfume;
import io.swagger.v3.oas.annotations.media.Schema;
import java.time.OffsetDateTime;

public record OwnershipStatusResponse(
        @Schema(description = "사용자 진열대 항목 ID", example = "155")
        Long shelfItemId,

        @Schema(description = "향수 보유 상태", example = "OWNED")
        OwnershipStatus ownershipStatus,

        @Schema(description = "수정 시각")
        OffsetDateTime updatedAt
) {

    public static OwnershipStatusResponse from(UserPerfume userPerfume) {
        return new OwnershipStatusResponse(
                userPerfume.getId(),
                userPerfume.getOwnershipStatus(),
                userPerfume.getUpdatedAt()
        );
    }
}
