package com.hyanghae.backend.community.repository;

/**
 * 최근 글에 언급된 향수 한 줄입니다.
 *
 * <p>인터페이스인 이유는 네이티브 쿼리 결과를 레코드 생성자로 바로 받을 수 없기 때문입니다.
 * Spring Data 가 컬럼 별칭을 보고 구현을 만들어 줍니다.
 */
public interface TrendingPerfumeRow {

    Long getPerfumeId();

    String getName();

    String getNameKo();

    String getBrand();

    String getBrandKo();

    long getMentionCount();
}
