package com.hyanghae.backend.shelf.dto.response;

import com.hyanghae.backend.shelf.entity.UserPerfume;
import io.swagger.v3.oas.annotations.media.Schema;
import java.time.OffsetDateTime;

public record RepresentativeResponse(
        @Schema(description = "사용자 진열대 항목 ID", example = "154")
        Long userPerfumeId,

        @Schema(description = "대표 향수 지정 여부", example = "true")
        boolean representative,

        @Schema(description = "수정 시각")
        OffsetDateTime updatedAt
) {

    public static RepresentativeResponse from(UserPerfume userPerfume) {
        return new RepresentativeResponse(
                userPerfume.getId(),
                Boolean.TRUE.equals(userPerfume.getRepresentative()),
                userPerfume.getUpdatedAt()
        );
    }
}
