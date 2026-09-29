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
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

@Service
public class AuthService {

    private static final Logger log = LoggerFactory.getLogger(AuthService.class);

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final AccessTokenService accessTokenService;
    private final RefreshTokenService refreshTokenService;
    private final AuthSessionStore sessionStore;
    private final CurrentSession currentSession;
    private final EmailVerificationService emailVerificationService;

    public AuthService(
            UserRepository userRepository,
            PasswordEncoder passwordEncoder,
            AccessTokenService accessTokenService,
            RefreshTokenService refreshTokenService,
            AuthSessionStore sessionStore,
            CurrentSession currentSession,
            EmailVerificationService emailVerificationService
    ) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.accessTokenService = accessTokenService;
        this.refreshTokenService = refreshTokenService;
        this.sessionStore = sessionStore;
        this.currentSession = currentSession;
        this.emailVerificationService = emailVerificationService;
    }

    @Transactional
    public SignupResponse signup(SignupRequest request) {
        String email = normalizeEmail(request.email());
        String nickname = normalizeNickname(request.nickname());

        if (userRepository.existsByEmail(email)) {
            throw new BusinessException(AuthErrorCode.AUTH_EMAIL_ALREADY_EXISTS);
        }
        emailVerificationService.requireVerified(email, request.emailVerificationToken());
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
        consumeVerificationAfterCommit(request.emailVerificationToken());
        return new SignupResponse(user.getId(), user.getEmail(), user.getNickname());
    }

    public AuthTokens login(LoginRequest request, String existingRefreshToken) {
        String email = normalizeEmail(request.email());
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new BusinessException(AuthErrorCode.AUTH_INVALID_CREDENTIALS));
        if (!passwordEncoder.matches(request.password(), user.getPasswordHash())) {
            throw new BusinessException(AuthErrorCode.AUTH_INVALID_CREDENTIALS);
        }

        refreshTokenService.revokeByToken(existingRefreshToken);
        RefreshTokenService.IssuedSession session = refreshTokenService.create(user.getId());
        String accessToken = accessTokenService.issue(user.getId(), session.sessionId());
        return new AuthTokens(accessToken, session.refreshToken());
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

    /**
     * 가입이 커밋된 뒤에만 인증 토큰을 지웁니다. 닉네임 중복이나 롤백으로 가입이 실패했는데
     * 토큰이 사라지면 인증번호부터 다시 받아야 합니다.
     */
    private void consumeVerificationAfterCommit(String token) {
        if (!TransactionSynchronizationManager.isSynchronizationActive()) {
            emailVerificationService.consume(token);
            return;
        }
        TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
            // 가입은 이미 커밋됐으므로 여기서 던지면 성공한 가입이 500 으로 보입니다.
            // 못 지운 토큰은 TTL 로 사라지고, 이메일 유니크 제약이 재가입을 막습니다.
            @Override
            public void afterCommit() {
                try {
                    emailVerificationService.consume(token);
                } catch (RuntimeException exception) {
                    log.warn("event=email_verification_consume_failed, reason={}",
                            exception.getClass().getSimpleName());
                }
            }
        });
    }

    private String normalizeEmail(String email) {
        return email.trim().toLowerCase(Locale.ROOT);
    }

    private String normalizeNickname(String nickname) {
        String normalized = nickname.trim();
        if (normalized.length() < 2 || normalized.length() > 20) {
            throw new BusinessException(AuthErrorCode.AUTH_INVALID_NICKNAME);
        }
        return normalized;
    }
}
