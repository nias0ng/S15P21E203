package com.hyanghae.backend.perfume.client;

import java.util.List;

/**
 * OpenAI 호환 채팅 완성 응답입니다. 필요한 필드만 받습니다.
 *
 * <p>모델이 만든 JSON 은 {@code choices[0].message.content} 안에 문자열로 들어 있습니다.
 * 응답 자체의 JSON 과 한 겹 더 들어간 JSON 을 따로 해석해야 합니다.
 */
record GmsChatResponse(List<Choice> choices) {

    /** 모델이 만든 본문입니다. 응답 형태가 예상과 다르면 {@code null} 입니다. */
    String content() {
        if (choices == null || choices.isEmpty()) {
            return null;
        }
        Choice first = choices.getFirst();
        if (first == null || first.message() == null) {
            return null;
        }
        return first.message().content();
    }

    record Choice(Message message) {
    }

    record Message(String content) {
    }
}
