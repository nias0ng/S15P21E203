package com.hyanghae.backend.auth.service;

import com.hyanghae.backend.auth.config.AuthProperties;
import com.hyanghae.backend.auth.exception.AuthErrorCode;
import com.hyanghae.backend.auth.service.GoogleAuthorizationStore.Authorization;
import com.hyanghae.backend.auth.service.GoogleAuthorizationStore.Purpose;
import com.hyanghae.backend.global.exception.BusinessException;
import com.hyanghae.backend.user.entity.User;
import com.hyanghae.backend.user.repository.UserRepository;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.Optional;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.util.UriComponentsBuilder;

/**
 * Google 로그인(OAuth 2.0 Authorization Code + PKCE)입니다.
 *
 * <ol>
 *   <li>{@link #start}: state · PKCE · nonce 를 만들어 기억하고 Google 로그인 화면 주소를 만듭니다.
 *   <li>사용자가 Google 에서 계정을 고르면 Google 이 code 를 들려 콜백으로 돌려보냅니다.
 *   <li>{@link #callback}: state 를 맞춰 보고 code 를 ID 토큰으로 바꿔, 로그인 · 가입 · 재확인 중 하나로
 *       끝냅니다.
 * </ol>
 *
 * <p>이미 이메일·비밀번호로 가입한 이메일이면 막습니다. 자동으로 이어 붙이면 그 계정에 들어갈 방법이 하나
 * 더 생기는데, 계정 주인이 그것을 허락한 적이 없습니다.
 */
@Service
public class GoogleAuthService {

    static final String AUTHORIZATION_URI = "https://accounts.google.com/o/oauth2/v2/auth";
    private static final String SCOPE = "openid email profile";
    private static final int RETURN_TO_MAX_LENGTH = 512;

    private final AuthProperties.Google properties;
    private final GoogleAuthorizationStore authorizationStore;
    private final GoogleOAuthClient oauthClient;
    private final GoogleSignupTicketStore signupTicketStore;
    private final UserRepository userRepository;
    private final AuthService authService;

    public GoogleAuthService(
            AuthProperties properties,
            GoogleAuthorizationStore authorizationStore,
            GoogleOAuthClient oauthClient,
            GoogleSignupTicketStore signupTicketStore,
            UserRepository userRepository,
            AuthService authService
    ) {
        this.properties = properties.google();
        this.authorizationStore = authorizationStore;
        this.oauthClient = oauthClient;
        this.signupTicketStore = signupTicketStore;
        this.userRepository = userRepository;
        this.authService = authService;
    }

    public boolean enabled() {
        return properties.enabled();
    }

    /** 로그인 · 가입을 시작합니다. {@code returnTo} 가 안전한 화면 경로가 아니면 버립니다. */
    public GoogleAuthorizationStart startLogin(String returnTo) {
        return start(Purpose.LOGIN, null, safeReturnTo(returnTo));
    }

    /** 로그인한 사람이 탈퇴 전에 Google 로 본인임을 다시 확인하기 시작합니다. */
    public GoogleAuthorizationStart startReauth(Long userId) {
        return start(Purpose.REAUTH, userId, null);
    }

    private GoogleAuthorizationStart start(Purpose purpose, Long userId, String returnTo) {
        if (!enabled()) {
            throw new BusinessException(AuthErrorCode.AUTH_GOOGLE_LOGIN_UNAVAILABLE);
        }
        String state = OpaqueTokens.random();
        String codeVerifier = OpaqueTokens.random();
        String nonce = OpaqueTokens.random();
        authorizationStore.save(
                state, new Authorization(purpose, userId, codeVerifier, nonce, returnTo));

        String url = UriComponentsBuilder.fromUriString(AUTHORIZATION_URI)
                .queryParam("client_id", properties.clientId())
                .queryParam("redirect_uri", properties.redirectUri())
                .queryParam("response_type", "code")
                .queryParam("scope", SCOPE)
                .queryParam("state", state)
                .queryParam("nonce", nonce)
                .queryParam("code_challenge", OpaqueTokens.sha256(codeVerifier))
                .queryParam("code_challenge_method", "S256")
                // 여러 계정을 쓰는 사람이 엉뚱한 계정으로 바로 들어가지 않게 매번 고르게 합니다.
                .queryParam("prompt", "select_account")
                .encode()
                .build()
                .toUriString();
        return new GoogleAuthorizationStart(state, url);
    }

    /**
     * Google 에서 돌아온 요청을 마무리합니다.
     *
     * <p>{@code browserState} 는 로그인을 시작한 브라우저에 심어 둔 쿠키 값입니다. 주소의 state 와 같아야
     * 합니다 — 남이 자기 code 를 담은 링크를 보내 피해자를 공격자 계정으로 로그인시키는 것을 막습니다.
     *
     * @param error Google 이 돌려준 오류. 사용자가 취소하면 {@code access_denied} 입니다
     */
    public GoogleCallbackResult callback(
            String browserState,
            String state,
            String code,
            String error,
            String existingRefreshToken
    ) {
        if (!sameState(browserState, state)) {
            return new GoogleCallbackResult.Failed(
                    Purpose.LOGIN, AuthErrorCode.AUTH_GOOGLE_LOGIN_FAILED, null);
        }
        Optional<Authorization> found = authorizationStore.consume(state);
        if (found.isEmpty()) {
            return new GoogleCallbackResult.Failed(
                    Purpose.LOGIN, AuthErrorCode.AUTH_GOOGLE_LOGIN_FAILED, null);
        }
        Authorization authorization = found.get();
        if (error != null || code == null || code.isBlank()) {
            return new GoogleCallbackResult.Failed(authorization.purpose(),
                    AuthErrorCode.AUTH_GOOGLE_LOGIN_CANCELLED, authorization.returnTo());
        }

        try {
            GoogleIdentity identity = oauthClient.exchange(
                    code, authorization.codeVerifier(), authorization.nonce());
            return authorization.purpose() == Purpose.LOGIN
                    ? login(identity, authorization.returnTo(), existingRefreshToken)
                    : reauth(identity, authorization.userId());
        } catch (BusinessException exception) {
            return new GoogleCallbackResult.Failed(
                    authorization.purpose(), exception.errorCode(), authorization.returnTo());
        }
    }

    private GoogleCallbackResult login(
            GoogleIdentity identity,
            String returnTo,
            String existingRefreshToken
    ) {
        Optional<User> linked = userRepository.findByGoogleSubject(identity.subject());
        if (linked.isPresent()) {
            return new GoogleCallbackResult.LoggedIn(
                    authService.issueTokens(linked.get().getId(), existingRefreshToken), returnTo);
        }

        Optional<User> sameEmail = userRepository.findByEmail(identity.email());
        if (sameEmail.isPresent()) {
            throw new BusinessException(sameEmail.get().hasPassword()
                    ? AuthErrorCode.AUTH_EMAIL_REGISTERED_WITH_PASSWORD
                    : AuthErrorCode.AUTH_EMAIL_ALREADY_EXISTS);
        }
        return new GoogleCallbackResult.SignupRequired(signupTicketStore.issue(identity), returnTo);
    }

    private GoogleCallbackResult reauth(GoogleIdentity identity, Long userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new BusinessException(AuthErrorCode.AUTH_USER_NOT_FOUND));
        if (!user.hasGoogleSubject(identity.subject())) {
            throw new BusinessException(AuthErrorCode.AUTH_GOOGLE_ACCOUNT_MISMATCH);
        }
        authorizationStore.grantReauth(userId);
        return new GoogleCallbackResult.Reauthenticated();
    }

    /** 닉네임 화면이 보여 줄 이메일과 추천 닉네임입니다. */
    public GoogleSignupInfo signupInfo(String signupTicket) {
        GoogleIdentity identity = findTicket(signupTicket);
        return new GoogleSignupInfo(identity.email(), suggestNickname(identity.name()));
    }

    /**
     * 가입표와 닉네임으로 가입을 끝내고 바로 로그인합니다.
     *
     * <p>닉네임이 겹치면 가입표를 그대로 둡니다. 다른 닉네임으로 다시 보내면 됩니다.
     */
    @Transactional
    public AuthTokens signup(String signupTicket, String nickname, String existingRefreshToken) {
        GoogleIdentity identity = findTicket(signupTicket);
        String normalized = authService.normalizeNickname(nickname);

        // 가입표를 받은 뒤 같은 이메일로 누가 먼저 가입했거나, 같은 표로 이미 가입을 끝낸 경우입니다.
        if (userRepository.existsByGoogleSubject(identity.subject())) {
            throw new BusinessException(AuthErrorCode.AUTH_SIGNUP_CONFLICT);
        }
        if (userRepository.existsByEmail(identity.email())) {
            throw new BusinessException(AuthErrorCode.AUTH_EMAIL_ALREADY_EXISTS);
        }
        if (userRepository.existsByNickname(normalized)) {
            throw new BusinessException(AuthErrorCode.AUTH_NICKNAME_ALREADY_EXISTS);
        }

        User user = User.signupWithGoogle(
                identity.email(),
                identity.subject(),
                normalized,
                OffsetDateTime.now(ZoneOffset.UTC)
        );
        try {
            userRepository.saveAndFlush(user);
        } catch (DataIntegrityViolationException exception) {
            throw new BusinessException(AuthErrorCode.AUTH_SIGNUP_CONFLICT);
        }
        signupTicketStore.delete(signupTicket);
        return authService.issueTokens(user.getId(), existingRefreshToken);
    }

    private GoogleIdentity findTicket(String signupTicket) {
        return signupTicketStore.find(signupTicket)
                .orElseThrow(() -> new BusinessException(
                        AuthErrorCode.AUTH_INVALID_GOOGLE_SIGNUP_TICKET));
    }

    /**
     * Google 프로필 이름을 닉네임 칸에 미리 채워 둘 값으로 다듬습니다. 겹치는지는 보지 않습니다 — 화면이
     * 입력 칸의 중복 확인으로 봅니다.
     */
    private String suggestNickname(String name) {
        if (name == null) {
            return null;
        }
        String trimmed = name.trim();
        int max = AuthService.NICKNAME_MAX_LENGTH;
        if (trimmed.length() > max) {
            // 이모지처럼 두 칸짜리 글자를 반으로 자르지 않습니다.
            int end = Character.isHighSurrogate(trimmed.charAt(max - 1)) ? max - 1 : max;
            trimmed = trimmed.substring(0, end).trim();
        }
        return trimmed.length() < AuthService.NICKNAME_MIN_LENGTH ? null : trimmed;
    }

    private boolean sameState(String browserState, String state) {
        if (browserState == null || state == null) {
            return false;
        }
        return MessageDigest.isEqual(
                browserState.getBytes(StandardCharsets.UTF_8),
                state.getBytes(StandardCharsets.UTF_8));
    }

    /**
     * 화면 안의 경로만 받습니다. 바깥 주소로 돌려보내는 통로가 되면 피싱에 쓰입니다. 화면의
     * {@code safeReturnPath} 와 같은 규칙입니다.
     */
    static String safeReturnTo(String returnTo) {
        if (returnTo == null
                || returnTo.length() > RETURN_TO_MAX_LENGTH
                || !returnTo.startsWith("/")
                || returnTo.startsWith("//")
                || returnTo.startsWith("/\\")
                || returnTo.chars().anyMatch(Character::isISOControl)) {
            return null;
        }
        return returnTo;
    }

    public record GoogleAuthorizationStart(String state, String authorizationUrl) {
    }

    public record GoogleSignupInfo(String email, String suggestedNickname) {
    }
}
