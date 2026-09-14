package com.hyanghae.backend.review.dto.request;

import com.fasterxml.jackson.annotation.JsonIgnore;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.AssertTrue;
import jakarta.validation.constraints.Size;

public record ReviewUpdateRequest(
        @Schema(description = "변경할 후기 제목. 생략하면 유지", maxLength = 50)
        @Size(max = 50)
        String title,

        @Schema(description = "변경할 후기 내용. 생략하면 유지", minLength = 10, maxLength = 1000)
        @Size(min = 10, max = 1000)
        String content
) {

    public ReviewUpdateRequest {
        title = title == null ? null : title.strip();
        content = content == null ? null : content.strip();
    }

    @JsonIgnore
    @AssertTrue(message = "수정할 제목 또는 내용을 올바르게 입력해야 합니다.")
    public boolean isValidRequest() {
        return (title != null || content != null)
                && (title == null || !title.isBlank())
                && (content == null || !content.isBlank());
    }
}
