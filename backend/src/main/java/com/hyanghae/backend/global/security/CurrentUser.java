package com.hyanghae.backend.global.security;

import java.util.Optional;

/**
 * 지금 요청을 보낸 사용자입니다.
 *
 * <p>인증이 아직 없습니다. 그래서 이 인터페이스는 "누가 요청했는가"라는 질문 하나만 남겨두고,
 * 답하는 방법은 구현체로 미룹니다. 인증이 붙으면 {@code SecurityContextHolder} 에서 꺼내는
 * 구현으로 이 파일이 아니라 구현체 한 개만 갈아끼우면 됩니다.
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
