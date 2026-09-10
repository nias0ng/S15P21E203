package com.hyanghae.backend.perfume.service;

import com.hyanghae.backend.perfume.repository.ReviewContent;
import java.util.List;

/**
 * 후기 원문을 읽어 요약과 키워드를 돌려주는 분석기입니다.
 *
 * <p>요약과 키워드를 한 번에 받습니다. 둘을 따로 호출하면 같은 후기를 두 번 보내게 되고, 요약과
 * 키워드가 서로 다른 근거에서 나옵니다.
 *
 * <p>인터페이스로 둔 이유는 배치의 판단(대상 선정·정규화·적재)을 외부 호출 없이 검증하기
 * 위해서입니다. 구현은 {@code GmsReviewAnalyzer} 하나이고, 테스트는 정해진 답을 주는 대역을
 * 끼웁니다.
 */
public interface ReviewAnalyzer {

    /**
     * 후기 원문을 분석합니다.
     *
     * <p>호출에 실패하거나 응답을 해석할 수 없으면 예외를 던집니다. 배치가 향수 단위로 잡아
     * 기록하고 다음 향수로 넘어갑니다.
     */
    ReviewAnalysis analyze(List<ReviewContent> reviews);

    /**
     * 분석 결과입니다.
     *
     * <p>{@code reviewKeywords} 에는 키워드가 하나도 나오지 않은 후기가 빠져 있을 수 있습니다.
     * 향 표현이 없는 후기까지 억지로 채우면 어휘가 오염됩니다.
     */
    record ReviewAnalysis(String summary, List<ReviewKeywords> reviewKeywords) {
    }

    /** 후기 하나에서 나온 키워드입니다. */
    record ReviewKeywords(Long reviewId, List<String> keywords) {
    }
}
