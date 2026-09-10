package com.hyanghae.backend.perfume.service;

import java.util.List;
import java.util.Map;

/**
 * 향수 하나에 적재할 키워드입니다. 정규화까지 끝난 값만 담깁니다.
 *
 * @param perfumeId          적재 대상 향수입니다. 로그와 실패 추적에 씁니다.
 * @param extractedReviewIds 이번 실행이 AI 에게 보낸 후기 번호입니다. 키워드가 나오지 않은 후기도
 *                           들어 있습니다. 이 후기들에 추출 시각을 남겨 다시 보내지 않게 합니다.
 * @param keywordsByReviewId 후기별 키워드입니다. 키워드가 나오지 않은 후기는 키가 없습니다.
 */
public record PerfumeReviewKeywords(
        Long perfumeId,
        List<Long> extractedReviewIds,
        Map<Long, List<String>> keywordsByReviewId
) {
}
