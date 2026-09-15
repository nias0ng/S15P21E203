package com.hyanghae.backend.review.dto.request;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Size;
import java.util.List;

/**
 * 후기 작성 요청입니다.
 *
 * <p>계절을 <b>번호가 아니라 코드</b>로 받습니다. {@code season_id} 는 자동 증가라 환경마다 다른
 * 값이 붙을 수 있고, 화면은 그 번호를 알 방법이 없습니다. 코드는 마이그레이션(V18)이 고정한
 * 값이라 어느 환경에서나 같습니다. 자유 게시판 분류가 같은 이유로 코드를 씁니다.
 */
public record ReviewCreateRequest(
        @Schema(description = "후기 제목", maxLength = 50)
        @NotBlank
        @Size(max = 50)
        String title,

        @Schema(description = "후기 내용", minLength = 10, maxLength = 1000)
        @NotBlank
        @Size(min = 10, max = 1000)
        String content,

        @Schema(description = "선택한 계절 코드. 중복 없이 1개 이상 4개 이하",
                example = "[\"SPRING\", \"SUMMER\"]",
                allowableValues = {"SPRING", "SUMMER", "AUTUMN", "WINTER"})
        @NotEmpty
        @Size(max = 4)
        List<@NotBlank String> seasonCodes
) {

    public ReviewCreateRequest {
        title = title == null ? null : title.strip();
        content = content == null ? null : content.strip();
    }
}
