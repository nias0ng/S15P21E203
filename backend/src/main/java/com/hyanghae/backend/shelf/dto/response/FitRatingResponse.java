package com.hyanghae.backend.shelf.dto.response;

import com.hyanghae.backend.shelf.entity.UserPerfume;
import io.swagger.v3.oas.annotations.media.Schema;
import java.math.BigDecimal;
import java.time.OffsetDateTime;

public record FitRatingResponse(
        @Schema(description = "사용자 진열대 항목 ID", example = "151")
        Long userPerfumeId,

        @Schema(description = "향수 취향 적합도", example = "4.5")
        BigDecimal fitRating,

        @Schema(description = "수정 시각")
        OffsetDateTime updatedAt
) {

    public static FitRatingResponse from(UserPerfume userPerfume) {
        return new FitRatingResponse(
                userPerfume.getId(),
                userPerfume.getFitRating(),
                userPerfume.getUpdatedAt()
        );
    }
}
