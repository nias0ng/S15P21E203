package com.hyanghae.backend.auth.service;

import com.hyanghae.backend.auth.dto.request.LoginRequest;
import com.hyanghae.backend.auth.dto.request.SignupRequest;
import com.hyanghae.backend.auth.dto.response.SignupResponse;
import com.hyanghae.backend.auth.exception.AuthErrorCode;
import com.hyanghae.backend.global.exception.BusinessException;
import com.hyanghae.backend.global.security.CurrentSession;
import com.hyanghae.backend.user.entity.User;
import com.hyanghae.backend.user.repository.UserRepository;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.Locale;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AuthService {

    static final int NICKNAME_MIN_LENGTH = 2;
    static final int NICKNAME_MAX_LENGTH = 20;

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final AccessTokenService accessTokenService;
    private final RefreshTokenService refreshTokenService;
    private final AuthSessionStore sessionStore;
    private final CurrentSession currentSession;

    public AuthService(
            UserRepository userRepository,
            PasswordEncoder passwordEncoder,
            AccessTokenService accessTokenService,
            RefreshTokenService refreshTokenService,
            AuthSessionStore sessionStore,
            CurrentSession currentSession
    ) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.accessTokenService = accessTokenService;
        this.refreshTokenService = refreshTokenService;
        this.sessionStore = sessionStore;
        this.currentSession = currentSession;
    }

    @Transactional
    public SignupResponse signup(SignupRequest request) {
        String email = normalizeEmail(request.email());
        String nickname = normalizeNickname(request.nickname());

        if (userRepository.existsByEmail(email)) {
            throw new BusinessException(AuthErrorCode.AUTH_EMAIL_ALREADY_EXISTS);
        }
        if (userRepository.existsByNickname(nickname)) {
            throw new BusinessException(AuthErrorCode.AUTH_NICKNAME_ALREADY_EXISTS);
        }

        User user = User.signup(
                email,
                passwordEncoder.encode(request.password()),
                nickname,
                OffsetDateTime.now(ZoneOffset.UTC)
        );
        try {
            userRepository.saveAndFlush(user);
        } catch (DataIntegrityViolationException exception) {
            throw new BusinessException(AuthErrorCode.AUTH_SIGNUP_CONFLICT);
        }
        return new SignupResponse(user.getId(), user.getEmail(), user.getNickname());
    }

    public AuthTokens login(LoginRequest request, String existingRefreshToken) {
        String email = normalizeEmail(request.email());
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new BusinessException(AuthErrorCode.AUTH_INVALID_CREDENTIALS));
        // Google 로 가입한 사람은 비밀번호가 없습니다. 없는 계정과 같은 답을 줍니다.
        if (!user.hasPassword()
                || !passwordEncoder.matches(request.password(), user.getPasswordHash())) {
            throw new BusinessException(AuthErrorCode.AUTH_INVALID_CREDENTIALS);
        }
        return issueTokens(user.getId(), existingRefreshToken);
    }

    public AuthTokens refresh(String refreshToken) {
        RefreshTokenService.IssuedSession session = refreshTokenService.rotate(refreshToken);
        AuthSession stored = sessionStore.find(session.sessionId())
                .orElseThrow(() -> new BusinessException(AuthErrorCode.AUTH_INVALID_REFRESH_TOKEN));
        String accessToken = accessTokenService.issue(stored.userId(), session.sessionId());
        return new AuthTokens(accessToken, session.refreshToken());
    }

    public void logout() {
        String sessionId = currentSession.id()
                .orElseThrow(() -> new BusinessException(AuthErrorCode.AUTH_LOGIN_REQUIRED));
        sessionStore.revoke(sessionId);
    }

    /** 로그인 세션을 새로 열고 토큰을 발급합니다. Google 로그인도 이것으로 끝냅니다. */
    AuthTokens issueTokens(Long userId, String existingRefreshToken) {
        refreshTokenService.revokeByToken(existingRefreshToken);
        RefreshTokenService.IssuedSession session = refreshTokenService.create(userId);
        String accessToken = accessTokenService.issue(userId, session.sessionId());
        return new AuthTokens(accessToken, session.refreshToken());
    }

    private String normalizeEmail(String email) {
        return email.trim().toLowerCase(Locale.ROOT);
    }

    String normalizeNickname(String nickname) {
        String normalized = nickname.trim();
        if (normalized.length() < NICKNAME_MIN_LENGTH
                || normalized.length() > NICKNAME_MAX_LENGTH) {
            throw new BusinessException(AuthErrorCode.AUTH_INVALID_NICKNAME);
        }
        return normalized;
    }
}
