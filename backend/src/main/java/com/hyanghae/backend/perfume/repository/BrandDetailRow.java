package com.hyanghae.backend.perfume.repository;

/**
 * 브랜드 상세 한 줄입니다.
 *
 * <p>목록과 달리 향수 수가 있습니다. 인터페이스인 이유는 {@link BrandSummaryRow} 와 같습니다 —
 * 네이티브 쿼리 결과는 인터페이스 프로젝션으로만 받을 수 있습니다.
 */
public interface BrandDetailRow {

    Long getBrandId();

    String getName();

    String getNameKo();

    String getLogoUrl();

    int getPerfumeCount();
}
