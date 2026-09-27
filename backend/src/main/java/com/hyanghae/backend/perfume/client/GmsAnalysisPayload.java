package com.hyanghae.backend.perfume.client;

import java.util.List;

/**
 * 모델이 만든 요약 JSON 입니다.
 *
 * <p>모델의 출력이므로 필드가 비어 있거나 형태가 어긋날 수 있다고 보고 다룹니다. 값의 정규화와
 * 검증은 {@code PerfumeReviewAnalysisBatchService} 가 합니다. 여기서 하면 프롬프트를 바꿀
 * 때마다 검증 규칙이 따라 흩어집니다.
 *
 * <p>요약을 한 문자열이 아니라 <b>줄 배열</b>로 받습니다. 화면은 줄이 나뉜 글을 보여주는데,
 * 한 문자열로 받으면 그 줄나눔이 모델이 {@code \n} 을 정확히 이스케이프했는지에 달립니다.
 * 배열이면 줄 경계가 JSON 구조로 드러나 어긋날 자리가 없고, 잇는 일은 {@link GmsReviewAnalyzer}
 * 가 합니다. 화면에 내려가는 것은 지금처럼 문자열 하나입니다.
 *
 * <p>필드가 하나라도 JSON 객체로 받습니다. {@code response_format} 을 {@code json_object} 로
 * 지정하려면 최상위가 객체여야 합니다.
 *
 * @param summary 요약을 이루는 줄들입니다. 첫 줄이 총평이고 그다음부터 주제별 한 줄입니다.
 */
record GmsAnalysisPayload(List<String> summary) {
}
