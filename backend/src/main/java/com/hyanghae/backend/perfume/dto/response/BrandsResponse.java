package com.hyanghae.backend.perfume.dto.response;

import java.util.List;

/**
 * 브랜드 목록입니다.
 *
 * <p>페이지 정보가 없습니다. 브랜드 페이지는 전부를 한 화면에 뿌리고, 브랜드 수는 향수처럼
 * 늘어나는 값이 아닙니다. 나중에 페이지가 필요해지면 이 자리에 더하면 되고, 배열을 그대로
 * 내보냈다면 그때 응답 모양이 통째로 바뀝니다.
 *
 * <p>브랜드가 없으면 빈 배열입니다. {@code null} 이 아닙니다.
 */
public record BrandsResponse(List<BrandSummaryResponse> brands) {
}
