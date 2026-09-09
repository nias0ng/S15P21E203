package com.hyanghae.backend.global.security;

import java.util.Optional;
import org.springframework.stereotype.Component;

/**
 * 인증이 붙기 전까지 쓰는 {@link CurrentUser} 구현입니다. 항상 비로그인으로 답합니다.
 *
 * <p>모든 요청이 비로그인이므로 로그인이 필요한 기능은 지금 전부 401 입니다. 임시 동작이 아니라
 * 인증이 붙은 뒤에도 비로그인 사용자에게는 같은 응답이 나갑니다. 로그인한 경우의 동작은 통합
 * 테스트가 가짜 구현으로 검증합니다.
 *
 * <p>인증이 들어오면 이 클래스를 지우고 {@code SecurityContextHolder} 를 읽는 구현으로 바꿉니다.
 */
@Component
public class AnonymousCurrentUser implements CurrentUser {

    @Override
    public Optional<Long> id() {
        return Optional.empty();
    }
}
