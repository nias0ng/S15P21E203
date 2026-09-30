package com.hyanghae.backend.auth.service;

import com.hyanghae.backend.auth.config.EmailVerificationProperties;
import com.hyanghae.backend.auth.dto.response.EmailVerificationConfirmResponse;
import com.hyanghae.backend.auth.dto.response.EmailVerificationResponse;
import com.hyanghae.backend.auth.exception.AuthErrorCode;
import com.hyanghae.backend.global.exception.BusinessException;
import com.hyanghae.backend.global.i18n.Language;
import com.hyanghae.backend.user.repository.UserRepository;
import java.time.Duration;
import java.util.Locale;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.mail.MailException;
import org.springframework.stereotype.Service;

/**
 * 회원가입 전에 이메일 주소의 주인인지 확인합니다.
 *
 * <p>번호를 맞히면 가입에 한 번 쓸 수 있는 토큰을 줍니다. 가입은 번호가 아니라 이 토큰을 받아,
 * 번호 확인과 가입 사이에 비밀번호·닉네임을 고치는 동안 번호가 만료돼도 다시 받지 않게 합니다.
 */
@Service
public class EmailVerificationService {

    private static final Logger log = LoggerFactory.getLogger(EmailVerificationService.class);

    private static final Duration SEND_WINDOW = Duration.ofHours(1);

    private final EmailVerificationStore store;
    private final EmailVerificationSecrets secrets;
    private final EmailVerificationMailSender mailSender;
    private final UserRepository userRepository;
    private final EmailVerificationProperties properties;

    public EmailVerificationService(
            EmailVerificationStore store,
            EmailVerificationSecrets secrets,
            EmailVerificationMailSender mailSender,
            UserRepository userRepository,
            EmailVerificationProperties properties
    ) {
        this.store = store;
        this.secrets = secrets;
        this.mailSender = mailSender;
        this.userRepository = userRepository;
        this.properties = properties;
    }

    public EmailVerificationResponse send(String rawEmail) {
        String email = normalizeEmail(rawEmail);
        if (userRepository.existsByEmail(email)) {
            throw new BusinessException(AuthErrorCode.AUTH_EMAIL_ALREADY_EXISTS);
        }

        switch (store.reserveSend(
                email, properties.resendCooldown(), properties.maxSendsPerHour(), SEND_WINDOW)) {
            case COOLDOWN -> throw new BusinessException(
                    AuthErrorCode.AUTH_EMAIL_VERIFICATION_RESEND_TOO_SOON);
            case LIMIT_EXCEEDED -> throw new BusinessException(
                    AuthErrorCode.AUTH_EMAIL_VERIFICATION_SEND_LIMIT_EXCEEDED);
            case RESERVED -> {
            }
        }

        // 메일을 먼저 보내고 번호를 저장합니다. 보내지 못했을 때 이전 번호가 그대로 살아 있고,
        // 받지도 못한 번호가 남지 않습니다.
        String code = secrets.newCode();
        try {
            mailSender.send(email, code, Language.current());
        } catch (MailException exception) {
            store.releaseSend(email);
            // 예외 메시지에 받는 사람 주소가 섞일 수 있어 종류만 남깁니다.
            log.warn(
                    "Email verification mail failed: exceptionType={}",
                    exception.getClass().getSimpleName()
            );
            throw new BusinessException(AuthErrorCode.AUTH_EMAIL_SEND_FAILED);
        } catch (RuntimeException exception) {
            store.releaseSend(email);
            throw exception;
        }
        store.saveCode(email, secrets.hash(code), properties.codeTtl());

        return new EmailVerificationResponse(
                properties.codeTtl().toSeconds(),
                properties.resendCooldown().toSeconds()
        );
    }

    public EmailVerificationConfirmResponse confirm(String rawEmail, String code) {
        String email = normalizeEmail(rawEmail);
        String storedHash = store.findCodeHash(email)
                .orElseThrow(() -> new BusinessException(
                        AuthErrorCode.AUTH_EMAIL_VERIFICATION_EXPIRED));

        if (!secrets.matches(code, storedHash)) {
            long attempts = store.recordFailure(email, storedHash, properties.maxAttempts());
            if (attempts == 0) {
                throw new BusinessException(AuthErrorCode.AUTH_EMAIL_VERIFICATION_EXPIRED);
            }
            if (attempts >= properties.maxAttempts()) {
                throw new BusinessException(
                        AuthErrorCode.AUTH_EMAIL_VERIFICATION_TOO_MANY_ATTEMPTS);
            }
            throw new BusinessException(AuthErrorCode.AUTH_EMAIL_VERIFICATION_CODE_MISMATCH);
        }
        if (!store.consumeCode(email, storedHash)) {
            throw new BusinessException(AuthErrorCode.AUTH_EMAIL_VERIFICATION_EXPIRED);
        }

        String token = secrets.newToken();
        store.saveVerified(token, email, properties.verifiedTtl());
        return new EmailVerificationConfirmResponse(token, properties.verifiedTtl().toSeconds());
    }

    /** 토큰이 없거나 만료됐거나 다른 이메일로 받은 것이면 가입을 막습니다. */
    public void requireVerified(String email, String token) {
        boolean verified = token != null && store.findVerifiedEmail(token)
                .map(normalizeEmail(email)::equals)
                .orElse(false);
        if (!verified) {
            throw new BusinessException(AuthErrorCode.AUTH_EMAIL_NOT_VERIFIED);
        }
    }

    public void consume(String token) {
        store.deleteVerified(token);
    }

    private String normalizeEmail(String email) {
        return email.trim().toLowerCase(Locale.ROOT);
    }
}
