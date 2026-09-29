package com.hyanghae.backend.auth.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.hyanghae.backend.auth.exception.AuthErrorCode;
import com.hyanghae.backend.global.exception.BusinessException;
import com.nimbusds.jose.jwk.JWKSet;
import com.nimbusds.jose.jwk.RSAKey;
import com.nimbusds.jose.jwk.gen.RSAKeyGenerator;
import com.nimbusds.jose.jwk.source.ImmutableJWKSet;
import java.time.Instant;
import java.util.List;
import java.util.function.Consumer;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.security.oauth2.jose.jws.SignatureAlgorithm;
import org.springframework.security.oauth2.jwt.JwsHeader;
import org.springframework.security.oauth2.jwt.JwtClaimsSet;
import org.springframework.security.oauth2.jwt.JwtEncoderParameters;
import org.springframework.security.oauth2.jwt.NimbusJwtDecoder;
import org.springframework.security.oauth2.jwt.NimbusJwtEncoder;

/**
 * Google 공개 키 대신 테스트에서 만든 RSA 키로 서명해, 검증 규칙만 봅니다.
 */
class GoogleIdTokenVerifierTest {

    private static final String CLIENT_ID = "hyanghae-web.apps.googleusercontent.com";
    private static final String SUBJECT = "108234567890123456789";
    private static final String NONCE = "nonce-from-authorize";

    private RSAKey googleKey;
    private GoogleIdTokenVerifier verifier;

    @BeforeEach
    void setUp() throws Exception {
        googleKey = new RSAKeyGenerator(2048).keyID("google-key").generate();
        verifier = new GoogleIdTokenVerifier(
                NimbusJwtDecoder.withPublicKey(googleKey.toRSAPublicKey()).build(),
                CLIENT_ID
        );
    }

    @Test
    void returnsIdentityFromValidToken() {
        GoogleIdentity identity = verifier.verify(sign(googleKey, claims -> { }), NONCE);

        assertThat(identity.subject()).isEqualTo(SUBJECT);
        assertThat(identity.email()).isEqualTo("sailor@gmail.com");
        assertThat(identity.name()).isEqualTo("향해자");
    }

    @Test
    void acceptsIssuerWithoutScheme() {
        String token = sign(googleKey, claims -> claims.issuer("accounts.google.com"));

        assertThat(verifier.verify(token, NONCE).subject()).isEqualTo(SUBJECT);
    }

    @Test
    void acceptsEmailVerifiedAsString() {
        String token = sign(googleKey, claims -> claims.claim("email_verified", "true"));

        assertThat(verifier.verify(token, NONCE).subject()).isEqualTo(SUBJECT);
    }

    /** 다른 서비스용으로 발급된 Google 토큰입니다. 이것이 통과하면 남의 토큰으로 로그인됩니다. */
    @Test
    void rejectsTokenIssuedForAnotherClient() {
        String token = sign(googleKey, claims -> claims.audience(List.of("other.apps.googleusercontent.com")));

        assertRejectedWith(token, AuthErrorCode.AUTH_INVALID_GOOGLE_TOKEN);
    }

    @Test
    void rejectsTokenFromAnotherIssuer() {
        String token = sign(googleKey, claims -> claims.issuer("https://evil.example.com"));

        assertRejectedWith(token, AuthErrorCode.AUTH_INVALID_GOOGLE_TOKEN);
    }

    @Test
    void rejectsExpiredToken() {
        Instant past = Instant.now().minusSeconds(3600);
        String token = sign(googleKey, claims -> claims.issuedAt(past.minusSeconds(60)).expiresAt(past));

        assertRejectedWith(token, AuthErrorCode.AUTH_INVALID_GOOGLE_TOKEN);
    }

    @Test
    void rejectsTokenSignedByAnotherKey() throws Exception {
        RSAKey otherKey = new RSAKeyGenerator(2048).keyID("google-key").generate();

        assertRejectedWith(sign(otherKey, claims -> { }), AuthErrorCode.AUTH_INVALID_GOOGLE_TOKEN);
    }

    @Test
    void rejectsMalformedToken() {
        assertRejectedWith("not-a-jwt", AuthErrorCode.AUTH_INVALID_GOOGLE_TOKEN);
    }

    /** 다른 로그인 시도에서 받은 토큰을 끼워 넣는 경우입니다. */
    @Test
    void rejectsTokenWithAnotherNonce() {
        String token = sign(googleKey, claims -> claims.claim("nonce", "someone-elses-nonce"));

        assertRejectedWith(token, AuthErrorCode.AUTH_INVALID_GOOGLE_TOKEN);
    }

    @Test
    void rejectsUnverifiedEmail() {
        String token = sign(googleKey, claims -> claims.claim("email_verified", false));

        assertRejectedWith(token, AuthErrorCode.AUTH_GOOGLE_EMAIL_NOT_VERIFIED);
    }

    @Test
    void rejectsTokenWithoutEmail() {
        String token = sign(googleKey, claims -> claims.claims(values -> values.remove("email")));

        assertRejectedWith(token, AuthErrorCode.AUTH_INVALID_GOOGLE_TOKEN);
    }

    @Test
    void answersUnavailableWhenClientIdIsNotConfigured() {
        GoogleIdTokenVerifier disabled = new GoogleIdTokenVerifier(null, "");

        assertThatThrownBy(() -> disabled.verify(sign(googleKey, claims -> { }), NONCE))
                .isInstanceOfSatisfying(BusinessException.class, exception ->
                        assertThat(exception.errorCode())
                                .isEqualTo(AuthErrorCode.AUTH_GOOGLE_LOGIN_UNAVAILABLE));
    }

    private void assertRejectedWith(String token, AuthErrorCode expected) {
        assertThatThrownBy(() -> verifier.verify(token, NONCE))
                .isInstanceOfSatisfying(BusinessException.class, exception ->
                        assertThat(exception.errorCode()).isEqualTo(expected));
    }

    private String sign(RSAKey key, Consumer<JwtClaimsSet.Builder> customizer) {
        Instant now = Instant.now();
        JwtClaimsSet.Builder claims = JwtClaimsSet.builder()
                .issuer("https://accounts.google.com")
                .audience(List.of(CLIENT_ID))
                .subject(SUBJECT)
                .issuedAt(now)
                .expiresAt(now.plusSeconds(3600))
                .claim("email", " Sailor@Gmail.com ")
                .claim("email_verified", true)
                .claim("name", "향해자")
                .claim("nonce", NONCE);
        customizer.accept(claims);

        NimbusJwtEncoder encoder = new NimbusJwtEncoder(new ImmutableJWKSet<>(new JWKSet(key)));
        return encoder.encode(JwtEncoderParameters.from(
                JwsHeader.with(SignatureAlgorithm.RS256).keyId(key.getKeyID()).build(),
                claims.build()
        )).getTokenValue();
    }
}
