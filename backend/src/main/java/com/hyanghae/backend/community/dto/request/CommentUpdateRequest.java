package com.hyanghae.backend.community.dto.request;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * 댓글 수정 요청입니다.
 *
 * <p>바꿀 항목이 {@code content} 하나뿐이고 그마저 필수라 {@code record} 로 충분합니다. 안 보낸
 * 경우와 {@code null} 을 보낸 경우가 모두 400 이라 둘을 구분할 이유가 없습니다.
 * {@link PostUpdateRequest} 가 클래스인 것과 다릅니다.
 */
public record CommentUpdateRequest(
        @Schema(description = "댓글 내용", maxLength = 500)
        @NotBlank(message = "내용을 입력해야 합니다.")
        @Size(max = 500, message = "댓글은 500자까지 쓸 수 있습니다.")
        String content
) {
}
