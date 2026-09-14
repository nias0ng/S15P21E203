package com.hyanghae.backend.perfume.repository;

/**
 * 브랜드 목록 한 줄입니다.
 *
 * <p>인터페이스인 이유가 있습니다. 이 줄은 네이티브 쿼리가 채우는데, 네이티브 결과는 레코드
 * 생성자로 바로 받을 수 없고 인터페이스 프로젝션으로만 받을 수 있습니다. Spring Data 가 컬럼
 * 별칭을 보고 구현을 만들어 줍니다.
 *
 * <p>향수 수가 없습니다. 화면이 카드에 그리지 않기로 했습니다. 향수 많은 순 정렬은 세는 일이
 * SQL 안에서 끝나 값이 밖으로 나올 필요가 없습니다.
 *
 * <p>{@code nameKo} 와 {@code logoUrl} 은 비어 있을 수 있습니다. 한국어 이름과 로고는 아직
 * 채워지지 않았습니다.
 */
public interface BrandSummaryRow {

    Long getBrandId();

    String getName();

    String getNameKo();

    String getLogoUrl();
}
