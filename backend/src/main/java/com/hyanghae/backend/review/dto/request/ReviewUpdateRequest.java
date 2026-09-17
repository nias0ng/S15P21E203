package com.hyanghae.backend.review.dto.request;

import com.fasterxml.jackson.annotation.JsonIgnore;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.AssertTrue;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.util.List;

/**
 * 후기를 고치는 요청입니다. <b>보낸 항목만 바뀝니다.</b>
 *
 * <p>제목 · 내용 · 계절을 <b>한 요청으로</b> 받습니다. 계절만 따로 받던 시절에는 화면이 두 번을
 * 불러야 했고, 앞이 저장된 뒤 뒤가 실패하면 서버에는 제목이 바뀌어 있는데 화면은 "아무것도
 * 저장 안 됨"으로 보이는 어긋남이 생겼습니다. 한 요청이면 전부 저장되거나 전부 취소됩니다.
 *
 * <p>작성({@link ReviewCreateRequest})은 처음부터 셋을 함께 받고 있었습니다. 수정만 나뉘어
 * 있던 것이 오히려 비대칭이었습니다.
 */
public record ReviewUpdateRequest(
        @Schema(description = "변경할 후기 제목. 생략하면 유지", maxLength = 50)
        @Size(max = 50)
        String title,

        @Schema(description = "변경할 후기 내용. 생략하면 유지", minLength = 10, maxLength = 1000)
        @Size(min = 10, max = 1000)
        String content,

        @Schema(description = "교체할 계절 코드. 생략하면 유지하고, 보내면 통째로 바뀝니다."
                + " 중복 없이 1개 이상 4개 이하입니다 — 후기에는 계절이 적어도 하나 있어야 하므로"
                + " 빈 배열로 비울 수 없습니다.",
                example = "[\"AUTUMN\", \"WINTER\"]",
                allowableValues = {"SPRING", "SUMMER", "AUTUMN", "WINTER"},
                nullable = true)
        @Size(min = 1, max = 4, message = "계절은 1개 이상 4개 이하로 보내야 합니다.")
        List<@NotBlank String> seasonCodes
) {

    public ReviewUpdateRequest {
        title = title == null ? null : title.strip();
        content = content == null ? null : content.strip();
    }

    /**
     * 고칠 것이 하나는 있어야 하고, 보낸 제목·내용은 비어 있으면 안 됩니다.
     *
     * <p>계절만 보내는 수정도 올바른 요청입니다. 화면에서 계절 칩만 바꾸고 저장하는 경우가
     * 있습니다.
     */
    @JsonIgnore
    @AssertTrue(message = "수정할 제목, 내용 또는 계절을 올바르게 입력해야 합니다.")
    public boolean isValidRequest() {
        return (title != null || content != null || seasonCodes != null)
                && (title == null || !title.isBlank())
                && (content == null || !content.isBlank());
    }
}
