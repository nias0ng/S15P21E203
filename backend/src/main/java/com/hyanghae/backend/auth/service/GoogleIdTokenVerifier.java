package com.hyanghae.backend.auth.service;

import com.hyanghae.backend.auth.config.AuthProperties;
import com.hyanghae.backend.auth.exception.AuthErrorCode;
import com.hyanghae.backend.global.exception.BusinessException;
import java.time.Duration;
import java.util.Collection;
import java.util.Locale;
import java.util.Set;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.web.client.RestTemplateBuilder;
import org.springframework.security.oauth2.core.DelegatingOAuth2TokenValidator;
import org.springframework.security.oauth2.jwt.BadJwtException;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtClaimNames;
import org.springframework.security.oauth2.jwt.JwtClaimValidator;
import org.springframework.security.oauth2.jwt.JwtException;
import org.springframework.security.oauth2.jwt.JwtTimestampValidator;
import org.springframework.security.oauth2.jwt.NimbusJwtDecoder;
import org.springframework.stereotype.Component;

/**
 * Google 토큰 엔드포인트가 돌려준 ID 토큰을 Google 의 공개 키로 검증합니다.
 *
 * <p>토큰은 우리 서버가 TLS 로 Google 에서 직접 받은 것이지만 그래도 서명을 봅니다. 검증을 한 곳에
 * 모아 두면 {@code aud} · {@code nonce} 확인이 빠지는 일이 없습니다.
 *
 * <p>공개 키는 처음 검증할 때 내려받고, 그 뒤로는 Nimbus 가 캐시해 두고 씁니다. Google 이 키를
 * 바꾸면 모르는 {@code kid} 가 들어올 때 다시 받습니다.
 */
@Component
public class GoogleIdTokenVerifier {

    private static final Logger log = LoggerFactory.getLogger(GoogleIdTokenVerifier.class);

    static final String JWK_SET_URI = "https://www.googleapis.com/oauth2/v3/certs";

    /** Google 은 두 형태를 모두 씁니다. */
    private static final Set<String> ISSUERS =
            Set.of("https://accounts.google.com", "accounts.google.com");

    /** 공개 키를 받는 요청이 오래 걸리면 로그인 요청도 같이 묶이므로 짧게 끊습니다. */
    private static final Duration JWK_TIMEOUT = Duration.ofSeconds(3);

    /** {@code null} 이면 Google 로그인을 쓰지 않는 환경입니다. */
    private final NimbusJwtDecoder decoder;

    @Autowired
    public GoogleIdTokenVerifier(
            AuthProperties properties,
            RestTemplateBuilder restTemplateBuilder
    ) {
        this(
                properties.google().enabled()
                        ? NimbusJwtDecoder.withJwkSetUri(JWK_SET_URI)
                                .restOperations(restTemplateBuilder
                                        .connectTimeout(JWK_TIMEOUT)
                                        .readTimeout(JWK_TIMEOUT)
                                        .build())
                                .build()
                        : null,
                properties.google().clientId()
        );
    }

    /** 테스트가 직접 만든 키로 서명한 토큰을 검증하게 할 때 씁니다. */
    GoogleIdTokenVerifier(NimbusJwtDecoder decoder, String clientId) {
        if (decoder != null) {
            // aud 가 빠지면 다른 서비스용으로 발급된 Google 토큰도 통과합니다.
            decoder.setJwtValidator(new DelegatingOAuth2TokenValidator<>(
                    new JwtTimestampValidator(),
                    new JwtClaimValidator<Object>(JwtClaimNames.ISS,
                            issuer -> issuer != null && ISSUERS.contains(issuer.toString())),
                    new JwtClaimValidator<Collection<String>>(JwtClaimNames.AUD,
                            audience -> audience != null && audience.contains(clientId))
            ));
        }
        this.decoder = decoder;
    }

    /**
     * 서명 · 발급자 · 대상 · 만료 · {@code nonce} 를 확인하고 계정 정보를 돌려줍니다.
     *
     * @param expectedNonce 로그인을 시작할 때 Google 에 보낸 값. 다른 로그인 시도의 토큰을 끼워
     *                      넣는 것을 막습니다
     */
    public GoogleIdentity verify(String idToken, String expectedNonce) {
        if (decoder == null) {
            throw new BusinessException(AuthErrorCode.AUTH_GOOGLE_LOGIN_UNAVAILABLE);
        }

        Jwt jwt;
        try {
            jwt = decoder.decode(idToken);
        } catch (BadJwtException exception) {
            throw new BusinessException(AuthErrorCode.AUTH_INVALID_GOOGLE_TOKEN);
        } catch (JwtException exception) {
            // 토큰이 아니라 공개 키를 받지 못한 경우입니다. 예외 메시지에 토큰 일부가 섞일 수
            // 있어 종류만 남깁니다.
            log.warn("event=google_id_token_verification_unavailable, exception={}",
                    exception.getClass().getSimpleName());
            throw new BusinessException(AuthErrorCode.AUTH_GOOGLE_LOGIN_UNAVAILABLE);
        }

        if (expectedNonce == null || !expectedNonce.equals(jwt.getClaimAsString("nonce"))) {
            throw new BusinessException(AuthErrorCode.AUTH_INVALID_GOOGLE_TOKEN);
        }
        String subject = jwt.getSubject();
        String email = jwt.getClaimAsString("email");
        if (isBlank(subject) || isBlank(email)) {
            throw new BusinessException(AuthErrorCode.AUTH_INVALID_GOOGLE_TOKEN);
        }
        if (!isTrue(jwt.getClaim("email_verified"))) {
            throw new BusinessException(AuthErrorCode.AUTH_GOOGLE_EMAIL_NOT_VERIFIED);
        }
        return new GoogleIdentity(
                subject,
                email.trim().toLowerCase(Locale.ROOT),
                jwt.getClaimAsString("name")
        );
    }

    /** 대부분 불리언이지만 문자열 {@code "true"} 로 오는 토큰도 있습니다. */
    private boolean isTrue(Object value) {
        return Boolean.TRUE.equals(value) || "true".equals(value);
    }

    private boolean isBlank(String value) {
        return value == null || value.isBlank();
    }
}
