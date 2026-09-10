package com.hyanghae.backend.perfume.client;

import java.util.List;

/**
 * 모델이 만든 분석 결과 JSON 입니다.
 *
 * <p>모델의 출력이므로 어떤 필드든 비어 있거나 형태가 어긋날 수 있다고 보고 다룹니다. 값의
 * 정규화와 검증은 {@code PerfumeReviewAnalysisBatchService} 가 합니다. 여기서 하면 프롬프트를
 * 바꿀 때마다 검증 규칙이 따라 흩어집니다.
 *
 * @param summary 후기 요약 본문입니다.
 * @param reviews 후기별 키워드입니다. 키워드가 없는 후기는 빠질 수 있습니다.
 */
record GmsAnalysisPayload(String summary, List<ReviewKeywordsPayload> reviews) {

    /**
     * 후기 하나에서 나온 키워드입니다.
     *
     * @param reviewId 입력으로 준 후기 번호입니다. 모델이 없는 번호를 만들어낼 수 있습니다.
     * @param keywords 향 표현 키워드입니다.
     */
    record ReviewKeywordsPayload(Long reviewId, List<String> keywords) {
    }
}
