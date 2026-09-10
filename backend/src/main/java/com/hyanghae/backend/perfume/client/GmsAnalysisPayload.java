package com.hyanghae.backend.perfume.client;

/**
 * 모델이 만든 요약 JSON 입니다.
 *
 * <p>모델의 출력이므로 필드가 비어 있거나 형태가 어긋날 수 있다고 보고 다룹니다. 값의 정규화와
 * 검증은 {@code PerfumeReviewAnalysisBatchService} 가 합니다. 여기서 하면 프롬프트를 바꿀
 * 때마다 검증 규칙이 따라 흩어집니다.
 *
 * <p>필드가 하나라 문자열만 받아도 되지만 JSON 객체로 받습니다. {@code response_format} 을
 * {@code json_object} 로 지정하려면 최상위가 객체여야 합니다.
 *
 * @param summary 후기 요약 본문입니다.
 */
record GmsAnalysisPayload(String summary) {
}
