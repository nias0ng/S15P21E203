package com.hyanghae.backend.perfume.service;

import java.util.List;
import java.util.Map;

/**
 * 향수 하나에 적재할 분석 결과입니다. 정규화까지 끝난 값만 담깁니다.
 *
 * @param perfumeId          적재 대상 향수입니다.
 * @param sourceReviewCount  요약의 기준이 된 후기 수입니다. 향수에 달린 전체 후기 수입니다.
 * @param summary            저장할 요약 본문입니다. 비어 있을 수 없습니다.
 * @param keywordTargetIds   이번 실행이 키워드를 책임지는 후기 번호입니다. 키워드가 나오지 않은
 *                           후기도 들어 있습니다. 이 후기들의 키워드는 이번 결과가 전부이고,
 *                           목록에 없는 후기의 키워드는 건드리지 않습니다. 키워드가 나온 후기만
 *                           담으면, 향 표현이 없다고 판정된 후기에 지난 키워드가 남습니다.
 * @param keywordsByReviewId 후기별 키워드입니다. 키워드가 나오지 않은 후기는 키가 없습니다.
 */
public record PerfumeReviewAnalysis(
        Long perfumeId,
        int sourceReviewCount,
        String summary,
        List<Long> keywordTargetIds,
        Map<Long, List<String>> keywordsByReviewId
) {
}
