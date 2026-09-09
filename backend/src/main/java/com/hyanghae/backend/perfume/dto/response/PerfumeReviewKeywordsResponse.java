package com.hyanghae.backend.perfume.dto.response;

import java.util.List;

/**
 * 후기 키워드 통계 응답입니다.
 *
 * <p>계절 통계와 달리 값이 없는 키워드를 0 으로 채우지 않습니다. 계절은 네 개로 고정이라 화면이
 * 빈 칸을 그려야 하지만, 키워드는 어휘가 열려 있어 "나오지 않은 키워드" 전부를 내려줄 수 없습니다.
 *
 * <p>많이 나온 순으로 정렬합니다. 화면이 앞에서 몇 개만 잘라 쓰면 됩니다.
 *
 * <p>키워드를 뽑는 파이프라인이 아직 없어 현재는 항상 빈 배열입니다.
 */
public record PerfumeReviewKeywordsResponse(List<PerfumeReviewKeywordResponse> keywords) {
}
