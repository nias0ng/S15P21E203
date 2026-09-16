package com.hyanghae.backend.auth.controller;

import com.hyanghae.backend.auth.dto.request.LoginRequest;
import com.hyanghae.backend.auth.dto.request.SignupRequest;
import com.hyanghae.backend.auth.dto.response.AccessTokenResponse;
import com.hyanghae.backend.auth.dto.response.SignupResponse;
import com.hyanghae.backend.auth.service.AuthService;
import com.hyanghae.backend.auth.service.AuthTokens;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import java.util.Arrays;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@Tag(name = "인증", description = "회원가입, 로그인과 토큰을 관리합니다.")
@RestController
@RequestMapping("/api/v1/auth")
public class AuthController {

    private final AuthService authService;
    private final RefreshTokenCookie refreshTokenCookie;

    public AuthController(AuthService authService, RefreshTokenCookie refreshTokenCookie) {
        this.authService = authService;
        this.refreshTokenCookie = refreshTokenCookie;
    }

    @Operation(summary = "회원가입")
    @ApiResponse(responseCode = "201", description = "가입 성공")
    @ApiResponse(responseCode = "400", description = "올바르지 않은 회원 정보")
    @ApiResponse(responseCode = "409", description = "이메일 또는 닉네임 중복")
    @PostMapping("/signup")
    @ResponseStatus(HttpStatus.CREATED)
    public SignupResponse signup(@Valid @RequestBody SignupRequest request) {
        return authService.signup(request);
    }

    @Operation(
            summary = "로그인",
            description = "Access Token은 본문으로, Refresh Token은 HttpOnly 쿠키로 발급합니다."
    )
    @ApiResponse(responseCode = "200", description = "로그인 성공")
    @ApiResponse(responseCode = "401", description = "이메일 또는 비밀번호 불일치")
    @PostMapping("/login")
    public AccessTokenResponse login(
            @Valid @RequestBody LoginRequest request,
            HttpServletRequest servletRequest,
            HttpServletResponse servletResponse
    ) {
        AuthTokens tokens = authService.login(request, findRefreshToken(servletRequest));
        setRefreshCookie(servletResponse, tokens);
        return new AccessTokenResponse(tokens.accessToken());
    }

    @Operation(
            summary = "토큰 재발급",
            description = "쿠키의 Refresh Token을 교체하고 새 Access Token을 반환합니다."
    )
    @ApiResponse(responseCode = "200", description = "재발급 성공")
    @ApiResponse(responseCode = "401", description = "Refresh Token 없음·만료·폐기")
    @PostMapping("/refresh")
    public AccessTokenResponse refresh(
            HttpServletRequest servletRequest,
            HttpServletResponse servletResponse
    ) {
        AuthTokens tokens = authService.refresh(findRefreshToken(servletRequest));
        setRefreshCookie(servletResponse, tokens);
        return new AccessTokenResponse(tokens.accessToken());
    }

    @Operation(summary = "로그아웃", description = "현재 로그인 세션만 종료합니다.")
    @ApiResponse(responseCode = "204", description = "로그아웃 성공")
    @ApiResponse(responseCode = "401", description = "로그인 필요")
    @PostMapping("/logout")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void logout(HttpServletResponse servletResponse) {
        authService.logout();
        servletResponse.addHeader(HttpHeaders.SET_COOKIE, refreshTokenCookie.expire().toString());
    }

    private String findRefreshToken(HttpServletRequest request) {
        if (request.getCookies() == null) {
            return null;
        }
        return Arrays.stream(request.getCookies())
                .filter(cookie -> refreshTokenCookie.name().equals(cookie.getName()))
                .map(jakarta.servlet.http.Cookie::getValue)
                .findFirst()
                .orElse(null);
    }

    private void setRefreshCookie(HttpServletResponse response, AuthTokens tokens) {
        response.addHeader(
                HttpHeaders.SET_COOKIE,
                refreshTokenCookie.issue(tokens.refreshToken()).toString()
        );
    }
}
