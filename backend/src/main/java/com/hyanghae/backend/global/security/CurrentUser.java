package com.hyanghae.backend.global.security;

import java.util.Optional;

/**
 * 지금 요청을 보낸 사용자입니다.
 *
 * <p>운영 구현체는 Spring Security의 {@code SecurityContextHolder}에서 인증된 사용자 번호를
 * 읽습니다. 인터페이스로 분리해 도메인 서비스가 인증 프레임워크에 직접 의존하지 않도록 합니다.
 *
 * <p>이렇게 나눠두면 사용자 기준 조회 로직을 지금 만들고 테스트할 수 있습니다. 테스트는 원하는
 * 사용자 번호를 돌려주는 가짜 구현을 넣습니다.
 *
 * <p>비어 있는 {@link Optional} 은 비로그인입니다. 로그인이 필요한 기능은 여기서 값을 꺼내지
 * 못하면 401 을 반환해야 합니다. 조용히 전체를 돌려주면 다른 사람의 자료가 새어 나갑니다.
 */
public interface CurrentUser {

    Optional<Long> id();
}
