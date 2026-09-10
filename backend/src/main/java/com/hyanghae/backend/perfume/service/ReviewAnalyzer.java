package com.hyanghae.backend.perfume.service;

import com.hyanghae.backend.perfume.repository.ReviewContent;
import java.util.List;

/**
 * 후기 원문을 읽어 향 표현 키워드를 돌려주는 분석기입니다.
 *
 * <p>요약 문장은 만들지 않습니다. 화면이 상위 키워드 몇 개와 그 비중으로 문장을 구성하기로
 * 정해졌습니다. 모델에게 문장까지 만들게 하면 출력이 길어져 호출 시간과 비용이 늘고, 화면이
 * 쓰지 않는 값을 저장하게 됩니다.
 *
 * <p>인터페이스로 둔 이유는 배치의 판단(대상 선정·정규화·적재)을 외부 호출 없이 검증하기
 * 위해서입니다. 구현은 {@code GmsReviewAnalyzer} 하나이고, 테스트는 정해진 답을 주는 대역을
 * 끼웁니다.
 */
public interface ReviewAnalyzer {

    /**
     * 후기에서 키워드를 뽑습니다.
     *
     * <p>호출에 실패하거나 응답을 해석할 수 없으면 예외를 던집니다. 배치가 향수 단위로 잡아
     * 기록하고 다음 향수로 넘어갑니다.
     */
    ExtractedKeywords extract(ExtractionSource source);

    /**
     * 추출에 넣을 자료입니다.
     *
     * @param reviews       키워드를 뽑을 후기입니다. 이미 키워드가 붙은 후기는 들어오지 않습니다.
     *                      다시 뽑아도 대체로 같은 값이 나오는데 출력만 길어집니다.
     * @param knownKeywords 이 향수의 후기에서 이미 쓰인 키워드 이름입니다. 모델에게 같은 뜻은
     *                      같은 표기로 쓰라고 알려 주는 데 씁니다. 이것이 없으면 이번에 뽑은
     *                      이름이 지난번과 달라져("파우더" 와 "파우더리") 같은 표현이 두
     *                      키워드로 갈라지고, 상위 몇 개를 뽑을 때 순위가 왜곡됩니다.
     */
    record ExtractionSource(List<ReviewContent> reviews, List<String> knownKeywords) {
    }

    /**
     * 추출 결과입니다.
     *
     * <p>키워드가 하나도 나오지 않은 후기는 빠져 있을 수 있습니다. 향 표현이 없는 후기까지
     * 억지로 채우면 어휘가 오염됩니다.
     */
    record ExtractedKeywords(List<ReviewKeywords> reviewKeywords) {
    }

    /** 후기 하나에서 나온 키워드입니다. */
    record ReviewKeywords(Long reviewId, List<String> keywords) {
    }
}
