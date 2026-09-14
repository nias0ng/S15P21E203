package com.hyanghae.backend.perfume.client;

import com.fasterxml.jackson.annotation.JsonProperty;
import java.util.List;

/**
 * OpenAI 호환 채팅 완성 요청입니다. GMS 가 그대로 상위 API 에 전달합니다.
 *
 * <p>{@code response_format} 을 {@code json_object} 로 지정합니다. 모델이 설명 문장이나
 * 코드 블록 표시를 붙이면 응답을 해석할 수 없는데, 이 옵션이 JSON 만 나오도록 강제합니다.
 * 이 옵션을 쓰려면 프롬프트에 "JSON" 이라는 단어가 있어야 한다는 제약이 있어
 * {@link GmsReviewAnalyzer} 의 지시문이 출력 형식을 JSON 으로 명시합니다.
 *
 * <p>{@code temperature} 를 보내지 않습니다. GPT-5 계열은 이 값을 기본값 외에는 받지 않고
 * 400 으로 거절합니다. 값이 하나 더 붙는 문제가 아니라 호출 자체가 실패합니다. 출력의 흔들림은
 * {@code json_object} 와 지시문으로 잡습니다.
 *
 * <p>지시문의 역할은 {@code developer} 입니다. GPT-5 계열이 쓰는 이름이고, {@code system} 은
 * 그 이전 세대의 이름입니다. 모델을 설정으로 바꿀 수 있게 두었으니, 옛 모델로 되돌릴 때는 이
 * 이름도 함께 확인해야 합니다.
 */
record GmsChatRequest(
        String model,
        List<Message> messages,
        @JsonProperty("response_format") ResponseFormat responseFormat
) {

    /** 지시문을 담는 메시지의 역할입니다. */
    private static final String INSTRUCTION_ROLE = "developer";

    /** 분석할 후기를 담는 메시지의 역할입니다. */
    private static final String CONTENT_ROLE = "user";

    static GmsChatRequest of(String model, String instruction, String reviews) {
        return new GmsChatRequest(
                model,
                List.of(
                        new Message(INSTRUCTION_ROLE, instruction),
                        new Message(CONTENT_ROLE, reviews)
                ),
                new ResponseFormat("json_object")
        );
    }

    record Message(String role, String content) {
    }

    record ResponseFormat(String type) {
    }
}
