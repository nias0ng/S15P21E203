package com.hyanghae.backend.shelf.dto.response;

import com.hyanghae.backend.shelf.entity.Memo;
import io.swagger.v3.oas.annotations.media.Schema;
import java.time.OffsetDateTime;

public record MemoUpdateResponse(
        @Schema(description = "메모 ID", example = "1")
        Long memoId,

        @Schema(description = "메모 내용")
        String content,

        @Schema(description = "마지막 수정 시각")
        OffsetDateTime updatedAt
) {

    public static MemoUpdateResponse from(Memo memo) {
        return new MemoUpdateResponse(
                memo.getId(),
                memo.getContent(),
                memo.getUpdatedAt()
        );
    }
}
