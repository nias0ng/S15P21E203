package com.hyanghae.backend.perfume.service;

/**
 * 한국어 후기 요약을 영어로 옮기는 번역기입니다.
 *
 * <p>후기 원문을 다시 요약하지 않습니다. 이미 만든 한국어 요약을 뜻이 같게 옮기기만 합니다.
 * 두 언어의 화면이 서로 다른 내용을 보여주면 안 되기 때문입니다.
 *
 * <p>인터페이스로 둔 이유는 {@link ReviewAnalyzer} 와 같습니다. 번역을 언제 하고 언제 저장본을
 * 쓰는지를 외부 호출 없이 검증하기 위해서입니다. 구현은 {@code GmsSummaryTranslator} 하나이고,
 * 테스트는 정해진 답을 주는 대역을 끼웁니다.
 */
public interface SummaryTranslator {

    /**
     * 번역을 부를 수 있는지입니다. 접속 키가 없으면 {@code false} 이고, 그때 화면은 한국어 요약을
     * 그대로 받습니다.
     */
    boolean isEnabled();

    /**
     * 한국어 요약을 영어로 옮깁니다. 줄 나눔을 그대로 지킵니다.
     *
     * <p>호출에 실패하거나 응답을 해석할 수 없으면 예외를 던집니다. 부르는 쪽이 잡아 한국어 요약으로
     * 되돌아갑니다. 예외 메시지에는 요약 본문을 넣지 않습니다.
     */
    String translateToEnglish(String koreanSummary);
}
