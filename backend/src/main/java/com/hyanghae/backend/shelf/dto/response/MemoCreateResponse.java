package com.hyanghae.backend.shelf.dto.response;

import com.hyanghae.backend.shelf.entity.Memo;
import io.swagger.v3.oas.annotations.media.Schema;
import java.time.OffsetDateTime;

public record MemoCreateResponse(
        @Schema(description = "메모 ID", example = "1")
        Long memoId,

        @Schema(description = "메모 내용")
        String content,

        @Schema(description = "작성 시각")
        OffsetDateTime createdAt
) {

    public static MemoCreateResponse from(Memo memo) {
        return new MemoCreateResponse(
                memo.getId(),
                memo.getContent(),
                memo.getCreatedAt()
        );
    }
}
