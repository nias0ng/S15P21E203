package com.hyanghae.backend.auth.service;

/**
 * Google 이 돌려준 authorization code 를 토큰으로 바꿉니다.
 *
 * <p>인터페이스로 둔 이유는 테스트입니다. 실제 구현은 Google 토큰 엔드포인트를 부르므로, 통합
 * 테스트는 가짜 구현으로 바꿔 끼웁니다.
 */
public interface GoogleOAuthClient {

    /**
     * code 를 ID 토큰으로 바꾸고, 검증한 계정 정보를 돌려줍니다.
     *
     * @param codeVerifier  로그인을 시작할 때 만든 PKCE 값. 가로챈 code 만으로는 바꿀 수 없게 합니다
     * @param expectedNonce 로그인을 시작할 때 Google 에 보낸 값
     * @throws com.hyanghae.backend.global.exception.BusinessException code 가 만료·재사용됐거나,
     *         토큰이 유효하지 않거나, Google 에 닿지 못할 때
     */
    GoogleIdentity exchange(String code, String codeVerifier, String expectedNonce);
}
