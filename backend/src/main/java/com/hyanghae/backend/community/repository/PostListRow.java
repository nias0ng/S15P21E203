package com.hyanghae.backend.community.repository;

import java.time.Instant;

/**
 * 목록 한 줄입니다.
 *
 * <p>인터페이스인 이유가 있습니다. 이 줄은 네이티브 쿼리가 채우는데, 네이티브 결과는 레코드
 * 생성자로 바로 받을 수 없고 인터페이스 프로젝션으로만 받을 수 있습니다. Spring Data 가 컬럼
 * 별칭을 보고 구현을 만들어 줍니다.
 *
 * <p>{@code createdAt} 만 {@link Instant} 입니다. 네이티브 결과의 {@code timestamptz} 를
 * Hibernate 가 {@link Instant} 로 읽어 주는데, 프로젝션이 다른 시간 타입을 요구하면 변환하지
 * 못하고 실패합니다. 서비스가 응답을 만들 때 시간대를 붙입니다.
 *
 * <p>대표 향수는 여기 없습니다. 한 번에 모아 읽는 편이 빨라서 별도 조회로 가져오고, 서비스가
 * 둘을 합쳐 응답을 만듭니다.
 */
public interface PostListRow {

    Long getPostId();

    String getCategory();

    String getTitle();

    String getNickname();

    Instant getCreatedAt();
}
