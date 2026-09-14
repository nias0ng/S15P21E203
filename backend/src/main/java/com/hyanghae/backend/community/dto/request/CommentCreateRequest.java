package com.hyanghae.backend.community.dto.request;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * 댓글 작성 요청입니다.
 *
 * <p>어느 글의 댓글인지는 URL 이 갖고 있어 {@code postId} 를 받지 않습니다.
 *
 * <p>{@code content} 를 500자로 제한합니다. {@code comments.content} 는 TEXT 라 DB 가 길이를
 * 막아주지 않습니다. 한도가 없으면 수 MB 짜리 댓글이 들어와 목록 조회 응답이 통째로 무거워집니다.
 */
public record CommentCreateRequest(
        @Schema(description = "댓글 내용", maxLength = 500)
        @NotBlank(message = "내용을 입력해야 합니다.")
        @Size(max = 500, message = "댓글은 500자까지 쓸 수 있습니다.")
        String content
) {

    /**
     * 앞뒤 공백을 만들 때 다듬습니다.
     *
     * <p>서비스가 아니라 여기서 다듬는 이유가 있습니다. 레코드의 압축 생성자는 어떤 경로로
     * 만들어도 반드시 지나가므로, 다듬지 않은 값이 서비스로 들어갈 길이 없습니다. 검증도 다듬은
     * 값에 걸려 공백만 보낸 요청이 400 으로 막힙니다.
     */
    public CommentCreateRequest {
        content = content == null ? null : content.strip();
    }
}
