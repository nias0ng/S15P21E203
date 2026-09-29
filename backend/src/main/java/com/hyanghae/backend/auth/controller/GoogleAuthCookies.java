package com.hyanghae.backend.auth.controller;

import com.hyanghae.backend.auth.config.AuthProperties;
import java.time.Duration;
import org.springframework.http.ResponseCookie;
import org.springframework.stereotype.Component;

/**
 * Google 로그인 동안만 쓰는 쿠키 둘입니다.
 *
 * <ul>
 *   <li>{@code google_oauth_state}: 로그인을 시작한 브라우저 표시. Google 에서 돌아온 주소의 state 와
 *       맞춰 봅니다.
 *   <li>{@code google_signup_ticket}: 닉네임을 정하기 전까지 들고 있는 가입표.
 * </ul>
 *
 * <p><b>{@code SameSite=Lax} 여야 합니다.</b> Google 에서 콜백으로 돌아오는 이동은 다른 사이트
 * (accounts.google.com)가 시작한 것이라, {@code Strict} 쿠키는 그 요청에 실리지 않습니다. {@code Lax} 는
 * 다른 사이트에서 넘어오는 GET 이동에는 실리고, 다른 사이트의 POST · 이미지 · iframe 요청에는 실리지
 * 않습니다.
 */
@Component
public class GoogleAuthCookies {

    static final String STATE = "google_oauth_state";
    static final String SIGNUP_TICKET = "google_signup_ticket";
    private static final String PATH = "/api/v1/auth/google";

    private final AuthProperties properties;

    public GoogleAuthCookies(AuthProperties properties) {
        this.properties = properties;
    }

    public ResponseCookie state(String state) {
        return base(STATE, state).maxAge(properties.google().authorizationTtl()).build();
    }

    public ResponseCookie expireState() {
        return base(STATE, "").maxAge(Duration.ZERO).build();
    }

    public ResponseCookie signupTicket(String ticket) {
        return base(SIGNUP_TICKET, ticket).maxAge(properties.google().signupTicketTtl()).build();
    }

    public ResponseCookie expireSignupTicket() {
        return base(SIGNUP_TICKET, "").maxAge(Duration.ZERO).build();
    }

    private ResponseCookie.ResponseCookieBuilder base(String name, String value) {
        return ResponseCookie.from(name, value)
                .httpOnly(true)
                .secure(properties.cookie().secure())
                .sameSite("Lax")
                .path(PATH);
    }
}
