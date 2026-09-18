package com.hyanghae.backend.recommendation.dto.request;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

/**
 * 추천이 마음에 들었는지입니다.
 *
 * <p><b>점수가 아니라 세 분류입니다.</b> 1~5 점으로 받으면 평균을 내게 되는데 "3.4점" 이 무엇을
 * 뜻하는지 설명할 수 없습니다. 세 분류는 "만족이 몇 건" 으로만 읽히고, 그것이 실제로 쓰는
 * 지표입니다.
 *
 * <p>화면에 보일 한국어 문구는 프론트엔드가 정합니다. 여기서 대문자 영문을 받는 것은 저장 값과
 * 표기를 떼어 두기 위해서입니다 — 문구를 바꿀 때 쌓인 데이터를 고치지 않아도 됩니다.
 *
 * @param satisfaction {@code SATISFIED} · {@code NEUTRAL} · {@code DISSATISFIED} 중 하나입니다.
 * @param comment      함께 쓴 한마디입니다. 선택입니다.
 */
public record NlrFeedbackRequest(

        @Schema(description = "만족 · 보통 · 불만족 중 하나입니다.",
                allowableValues = {"SATISFIED", "NEUTRAL", "DISSATISFIED"},
                example = "SATISFIED")
        @NotNull
        Satisfaction satisfaction,

        @Schema(description = "함께 쓸 한마디입니다. 없어도 됩니다.",
                example = "원하던 느낌이었어요", nullable = true, maxLength = 500)
        @Size(max = 500)
        String comment
) {

    /**
     * 만족도 세 분류입니다.
     *
     * <p>enum 으로 받으면 Jackson 이 이 셋 밖의 값을 400 으로 거절합니다. 문자열로 받고 서비스
     * 에서 검사하면 같은 일을 두 번 하게 되고, DB 의 {@code CHECK} 제약까지 내려가면 500 이
     * 됩니다.
     */
    public enum Satisfaction {
        SATISFIED,
        NEUTRAL,
        DISSATISFIED
    }
}
