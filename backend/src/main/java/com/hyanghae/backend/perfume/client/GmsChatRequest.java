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
 */
record GmsChatRequest(
        String model,
        double temperature,
        List<Message> messages,
        @JsonProperty("response_format") ResponseFormat responseFormat
) {

    static GmsChatRequest of(String model, double temperature, String instruction, String reviews) {
        return new GmsChatRequest(
                model,
                temperature,
                List.of(new Message("system", instruction), new Message("user", reviews)),
                new ResponseFormat("json_object")
        );
    }

    record Message(String role, String content) {
    }

    record ResponseFormat(String type) {
    }
}
