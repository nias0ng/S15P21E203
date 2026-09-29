package com.hyanghae.backend.auth.controller;

import com.hyanghae.backend.auth.dto.request.GoogleSignupRequest;
import com.hyanghae.backend.auth.dto.response.AccessTokenResponse;
import com.hyanghae.backend.auth.dto.response.GoogleAuthorizationResponse;
import com.hyanghae.backend.auth.dto.response.GoogleSignupInfoResponse;
import com.hyanghae.backend.auth.exception.AuthErrorCode;
import com.hyanghae.backend.auth.service.AuthTokens;
import com.hyanghae.backend.auth.service.GoogleAuthService;
import com.hyanghae.backend.auth.service.GoogleAuthService.GoogleAuthorizationStart;
import com.hyanghae.backend.auth.service.GoogleAuthService.GoogleSignupInfo;
import com.hyanghae.backend.auth.service.GoogleAuthorizationStore.Purpose;
import com.hyanghae.backend.auth.service.GoogleCallbackResult;
import com.hyanghae.backend.global.exception.BusinessException;
import com.hyanghae.backend.global.security.CurrentUser;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import java.net.URI;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.Arrays;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CookieValue;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/**
 * Google 로그인입니다. 브라우저가 Google 로그인 화면으로 갔다가 돌아오는 방식(OAuth 2.0 Authorization
 * Code)이라, {@code authorize} 와 {@code callback} 은 API 호출이 아니라 <b>페이지 이동</b>입니다.
 *
 * <p>콜백이 끝나면 화면의 경로로 302 를 보냅니다. 경로는 화면 라우트와 한 벌입니다
 * ({@code frontend/src/shared/config/routes.ts} 의 {@code LOGIN} · {@code GOOGLE_LOGIN} ·
 * {@code GOOGLE_SIGNUP} · {@code ACCOUNT}).
 *
 * <p>Location 을 상대 경로로 둡니다. 화면과 API 가 같은 출처(nginx · vite 프록시)라 그대로 화면으로
 * 갑니다. {@code sendRedirect} 를 쓰지 않는 이유는, 프록시 뒤에서 Tomcat 이 절대 주소로 바꾸며
 * https 를 http 로 적을 수 있어서입니다.
 */
@Tag(name = "Google 로그인", description = "Google 로그인 화면을 거쳐 가입 · 로그인합니다.")
@RestController
@RequestMapping("/api/v1/auth/google")
public class GoogleAuthController {

    static final String LOGIN_PAGE = "/login";
    static final String LOGIN_DONE_PAGE = "/login/google";
    static final String SIGNUP_PAGE = "/signup/google";
    static final String ACCOUNT_PAGE = "/account";
    static final String RETURN_PATH_PARAM = "redirectTo";
    static final String ERROR_PARAM = "googleError";
    static final String REAUTH_PARAM = "googleReauth";

    private final GoogleAuthService googleAuthService;
    private final GoogleAuthCookies cookies;
    private final RefreshTokenCookie refreshTokenCookie;
    private final CurrentUser currentUser;

    public GoogleAuthController(
            GoogleAuthService googleAuthService,
            GoogleAuthCookies cookies,
            RefreshTokenCookie refreshTokenCookie,
            CurrentUser currentUser
    ) {
        this.googleAuthService = googleAuthService;
        this.cookies = cookies;
        this.refreshTokenCookie = refreshTokenCookie;
        this.currentUser = currentUser;
    }

    @Operation(
            summary = "Google 로그인 시작",
            description = "페이지 이동으로 엽니다(fetch 가 아님). Google 로그인 화면으로 302 를 보내고,"
                    + " 이 브라우저를 표시하는 state 쿠키를 심습니다. Google 로그인을 쓰지 않는 환경이면"
                    + " /login?googleError=AUTH_GOOGLE_LOGIN_UNAVAILABLE 로 돌려보냅니다."
    )
    @ApiResponse(responseCode = "302", description = "Google 로그인 화면 또는 로그인 화면으로 이동")
    @GetMapping("/authorize")
    public ResponseEntity<Void> authorize(
            @Parameter(description = "로그인 뒤 돌아갈 화면 경로. /로 시작하는 경로만 받습니다",
                    example = "/shelf")
            @RequestParam(name = RETURN_PATH_PARAM, required = false) String returnTo
    ) {
        if (!googleAuthService.enabled()) {
            return ResponseEntity.status(HttpStatus.FOUND)
                    .location(location(LOGIN_PAGE,
                            ERROR_PARAM, AuthErrorCode.AUTH_GOOGLE_LOGIN_UNAVAILABLE.code()))
                    .build();
        }
        GoogleAuthorizationStart start = googleAuthService.startLogin(returnTo);
        return ResponseEntity.status(HttpStatus.FOUND)
                .header(HttpHeaders.LOCATION, start.authorizationUrl())
                .header(HttpHeaders.SET_COOKIE, cookies.state(start.state()).toString())
                .build();
    }

    @Operation(
            summary = "탈퇴 전 Google 재확인 시작",
            description = "Google 로 가입한 사람이 탈퇴하기 전에 부릅니다. state 쿠키를 심고 Google 로그인"
                    + " 화면 주소를 돌려줍니다. 화면은 그 주소로 페이지를 이동시키고, 확인이 끝나면"
                    + " /account?googleReauth=ok 로 돌아옵니다. 그 뒤 5분 안에 탈퇴할 수 있습니다."
    )
    @ApiResponse(responseCode = "200", description = "Google 로그인 화면 주소")
    @ApiResponse(responseCode = "401", description = "로그인 필요")
    @ApiResponse(responseCode = "503", description = "Google 로그인을 쓸 수 없는 상태")
    @PostMapping("/reauth")
    public ResponseEntity<GoogleAuthorizationResponse> reauth() {
        Long userId = currentUser.id()
                .orElseThrow(() -> new BusinessException(AuthErrorCode.AUTH_LOGIN_REQUIRED));
        GoogleAuthorizationStart start = googleAuthService.startReauth(userId);
        return ResponseEntity.ok()
                .header(HttpHeaders.SET_COOKIE, cookies.state(start.state()).toString())
                .body(new GoogleAuthorizationResponse(start.authorizationUrl()));
    }

    @Operation(
            summary = "Google 로그인 콜백",
            description = "Google 이 돌려보내는 주소입니다. Google Cloud 콘솔의 승인된 리디렉션 URI 로"
                    + " 등록합니다. 결과에 따라 화면으로 302 를 보냅니다 — 로그인됨: /login/google"
                    + " (Refresh Token 쿠키 발급), 처음 온 사람: /signup/google (가입표 쿠키 발급),"
                    + " 재확인: /account?googleReauth=ok, 실패: /login?googleError={code}."
    )
    @ApiResponse(responseCode = "302", description = "화면으로 이동")
    @GetMapping("/callback")
    public ResponseEntity<Void> callback(
            @RequestParam(required = false) String state,
            @RequestParam(required = false) String code,
            @RequestParam(required = false) String error,
            @CookieValue(name = GoogleAuthCookies.STATE, required = false) String browserState,
            HttpServletRequest request
    ) {
        GoogleCallbackResult result = googleAuthService.callback(
                browserState, state, code, error, findCookie(request, refreshTokenCookie.name()));

        ResponseEntity.HeadersBuilder<?> response = ResponseEntity.status(HttpStatus.FOUND)
                .header(HttpHeaders.SET_COOKIE, cookies.expireState().toString());

        return switch (result) {
            case GoogleCallbackResult.LoggedIn loggedIn -> response
                    .header(HttpHeaders.SET_COOKIE,
                            refreshTokenCookie.issue(loggedIn.tokens().refreshToken()).toString())
                    .location(location(LOGIN_DONE_PAGE, RETURN_PATH_PARAM, loggedIn.returnTo()))
                    .build();
            case GoogleCallbackResult.SignupRequired signup -> response
                    .header(HttpHeaders.SET_COOKIE,
                            cookies.signupTicket(signup.signupTicket()).toString())
                    .location(location(SIGNUP_PAGE, RETURN_PATH_PARAM, signup.returnTo()))
                    .build();
            case GoogleCallbackResult.Reauthenticated ignored -> response
                    .location(location(ACCOUNT_PAGE, REAUTH_PARAM, "ok"))
                    .build();
            case GoogleCallbackResult.Failed failed -> response
                    .location(failed.purpose() == Purpose.REAUTH
                            ? location(ACCOUNT_PAGE, REAUTH_PARAM, failed.errorCode().code())
                            : location(LOGIN_PAGE,
                                    ERROR_PARAM, failed.errorCode().code(),
                                    RETURN_PATH_PARAM, failed.returnTo()))
                    .build();
        };
    }

    @Operation(
            summary = "Google 가입 정보",
            description = "닉네임 화면이 보여 줄 Google 이메일과 추천 닉네임입니다. 콜백이 심은 가입표"
                    + " 쿠키로 찾습니다."
    )
    @ApiResponse(responseCode = "200", description = "조회 성공")
    @ApiResponse(responseCode = "401", description = "가입표가 없거나 만료됨")
    @GetMapping("/signup")
    public GoogleSignupInfoResponse signupInfo(
            @CookieValue(name = GoogleAuthCookies.SIGNUP_TICKET, required = false) String ticket
    ) {
        GoogleSignupInfo info = googleAuthService.signupInfo(ticket);
        return new GoogleSignupInfoResponse(info.email(), info.suggestedNickname());
    }

    @Operation(
            summary = "Google 회원가입",
            description = "가입표 쿠키와 닉네임으로 가입하고 바로 로그인합니다. Access Token 은 본문으로,"
                    + " Refresh Token 은 HttpOnly 쿠키로 발급합니다. 닉네임이 겹쳐 실패하면 다른"
                    + " 닉네임으로 다시 보낼 수 있습니다."
    )
    @ApiResponse(responseCode = "201", description = "가입과 로그인 성공")
    @ApiResponse(responseCode = "400", description = "닉네임 형식 오류")
    @ApiResponse(responseCode = "401", description = "가입표가 없거나 만료됨")
    @ApiResponse(responseCode = "409", description = "이메일 또는 닉네임 중복")
    @PostMapping("/signup")
    @ResponseStatus(HttpStatus.CREATED)
    public AccessTokenResponse signup(
            @Valid @RequestBody GoogleSignupRequest request,
            @CookieValue(name = GoogleAuthCookies.SIGNUP_TICKET, required = false) String ticket,
            HttpServletRequest servletRequest,
            HttpServletResponse servletResponse
    ) {
        AuthTokens tokens = googleAuthService.signup(
                ticket, request.nickname(), findCookie(servletRequest, refreshTokenCookie.name()));
        servletResponse.addHeader(HttpHeaders.SET_COOKIE,
                refreshTokenCookie.issue(tokens.refreshToken()).toString());
        servletResponse.addHeader(HttpHeaders.SET_COOKIE, cookies.expireSignupTicket().toString());
        return new AccessTokenResponse(tokens.accessToken());
    }

    /**
     * 화면 경로에 쿼리를 붙입니다. 값이 {@code null} 인 쌍은 뺍니다.
     *
     * <p>값을 직접 인코딩하는 이유는 돌아갈 경로({@code /shelf?stage=collection})에 {@code ?} · {@code &}
     * 가 들어 있어서입니다. 그대로 두면 화면이 쿼리를 둘로 쪼개 읽습니다.
     */
    static URI location(String path, String... pairs) {
        StringBuilder location = new StringBuilder(path);
        char separator = '?';
        for (int i = 0; i < pairs.length; i += 2) {
            if (pairs[i + 1] == null) {
                continue;
            }
            location.append(separator)
                    .append(pairs[i])
                    .append('=')
                    .append(URLEncoder.encode(pairs[i + 1], StandardCharsets.UTF_8));
            separator = '&';
        }
        return URI.create(location.toString());
    }

    private static String findCookie(HttpServletRequest request, String name) {
        if (request.getCookies() == null) {
            return null;
        }
        return Arrays.stream(request.getCookies())
                .filter(cookie -> name.equals(cookie.getName()))
                .map(Cookie::getValue)
                .findFirst()
                .orElse(null);
    }
}
