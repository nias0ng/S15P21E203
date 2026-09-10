package com.hyanghae.backend.perfume.service;

import com.hyanghae.backend.perfume.repository.ReviewContent;
import java.util.List;
import java.util.Set;

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
    ReviewAnalysis analyze(AnalysisSource source);

    /**
     * 분석에 넣을 자료입니다.
     *
     * <p>요약의 근거와 키워드를 뽑을 대상이 다릅니다. 요약은 향수 하나에 대한 글이라 최근 후기
     * 전체를 읽어야 하지만, 키워드는 후기마다 붙는 값이라 이미 뽑아 둔 후기를 다시 뽑을 이유가
     * 없습니다. 다시 뽑으면 출력이 그만큼 길어져 호출 시간과 비용만 늘고, 결과는 대체로 같습니다.
     *
     * @param reviews          요약의 근거가 되는 후기입니다. 최근 작성 순입니다.
     * @param keywordTargetIds 키워드를 뽑을 후기 번호입니다. {@code reviews} 중 아직 키워드가
     *                         붙지 않은 것들입니다. 비어 있으면 요약만 다시 만듭니다.
     * @param knownKeywords    이 향수의 후기에서 이미 쓰인 키워드 이름입니다. 모델에게 같은 뜻은
     *                         같은 표기로 쓰라고 알려 주는 데 씁니다. 이것이 없으면 이번에 뽑은
     *                         이름이 지난번과 달라져("파우더" 와 "파우더리") 같은 표현이 두
     *                         키워드로 갈라집니다.
     */
    record AnalysisSource(
            List<ReviewContent> reviews,
            Set<Long> keywordTargetIds,
            List<String> knownKeywords
    ) {
    }

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
