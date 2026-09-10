package com.hyanghae.backend.perfume.service;

import com.hyanghae.backend.perfume.repository.ReviewContent;
import java.util.List;

/**
 * 후기 원문을 읽어 요약 문장을 돌려주는 분석기입니다.
 *
 * <p>키워드는 뽑지 않습니다. 화면의 AI 후기 요약 구역이 {@code summary_text} 를 그대로 문장으로
 * 보여주기로 정해졌습니다. 키워드 통계 구역은 별개이고, 지금은 그것을 채우는 코드가 없습니다.
 *
 * <p>인터페이스로 둔 이유는 배치의 판단(대상 선정·정규화·적재)을 외부 호출 없이 검증하기
 * 위해서입니다. 구현은 {@code GmsReviewAnalyzer} 하나이고, 테스트는 정해진 답을 주는 대역을
 * 끼웁니다.
 */
public interface ReviewAnalyzer {

    /**
     * 후기를 읽고 요약 문장을 만듭니다.
     *
     * <p>호출에 실패하거나 응답을 해석할 수 없으면 예외를 던집니다. 배치가 향수 단위로 잡아
     * 기록하고 다음 향수로 넘어갑니다. 요약이 비어 있으면 {@code null} 이나 빈 문자열이 올 수
     * 있고, 그 판단은 배치가 합니다.
     */
    String summarize(List<ReviewContent> reviews);
}
