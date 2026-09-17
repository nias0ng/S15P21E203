package com.hyanghae.backend.review.dto.response;

import io.swagger.v3.oas.annotations.media.Schema;
import java.time.Instant;
import java.util.List;

/**
 * 방금 쓴 후기입니다.
 *
 * <p>계절을 코드로 돌려줍니다. 요청이 코드로 들어왔으니 응답도 같은 말을 써야 화면이 보낸 값과
 * 받은 값을 견줄 수 있습니다.
 */
public record ReviewCreateResponse(
        Long reviewId,
        String title,
        String content,

        @Schema(description = "저장된 계절 코드", example = "[\"SPRING\", \"SUMMER\"]")
        List<String> seasonCodes,

        Instant createdAt
) {
}
