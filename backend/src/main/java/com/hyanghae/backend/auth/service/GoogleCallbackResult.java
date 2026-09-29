package com.hyanghae.backend.auth.service;

import com.hyanghae.backend.auth.service.GoogleAuthorizationStore.Purpose;
import com.hyanghae.backend.global.exception.ErrorCode;

/**
 * Google 에서 돌아온 뒤의 결과입니다. 컨트롤러는 이것을 보고 화면의 어느 주소로 보낼지 정합니다.
 */
public sealed interface GoogleCallbackResult {

    /** 이미 가입한 사람. Refresh Token 을 쿠키로 주고 로그인 마무리 화면으로 보냅니다. */
    record LoggedIn(AuthTokens tokens, String returnTo) implements GoogleCallbackResult {
    }

    /** 처음 온 사람. 가입표를 쿠키로 주고 닉네임 화면으로 보냅니다. */
    record SignupRequired(String signupTicket, String returnTo) implements GoogleCallbackResult {
    }

    /** 탈퇴 전 재확인을 마침. 정보 변경 화면으로 돌려보냅니다. */
    record Reauthenticated() implements GoogleCallbackResult {
    }

    /** 취소 · 실패. {@code purpose} 에 따라 로그인 화면이나 정보 변경 화면으로 돌려보냅니다. */
    record Failed(Purpose purpose, ErrorCode errorCode, String returnTo)
            implements GoogleCallbackResult {
    }
}
