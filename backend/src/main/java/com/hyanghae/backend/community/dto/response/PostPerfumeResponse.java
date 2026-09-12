package com.hyanghae.backend.community.dto.response;

/**
 * 글에 걸린 향수입니다. 화면은 이 번호로 향수 상세로 넘어갑니다.
 *
 * <p>{@code brand} 가 비어 있을 수 있습니다. 인계 데이터에 브랜드가 없는 향수가 있습니다.
 */
public record PostPerfumeResponse(Long perfumeId, String name, String brand) {
}
