package com.hyanghae.backend.perfume.dto.response;

/**
 * 향수 기본 정보에 중첩되는 브랜드입니다.
 *
 * <p>이름이 둘입니다. 상세 화면이 <b>한국어를 위에, 영문을 작게</b> 그립니다(와이어프레임 A33).
 *
 * <p>{@code nameKo} 는 비어 있을 수 있고, 그때 화면은 영문으로 대신합니다. 한국어 이름이 아직
 * 없는 브랜드가 있고, 영문 표기만 다른 중복 브랜드는 한쪽만 한국어 이름을 갖습니다.
 */
public record BrandResponse(Long brandId, String name, String nameKo) {
}
