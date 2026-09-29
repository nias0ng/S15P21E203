package com.hyanghae.backend.auth.service;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.util.Base64;

/**
 * Google 로그인에서 쓰는 무작위 값(state · PKCE · nonce · 가입표)을 만들고 해시합니다.
 *
 * <p>Redis 에는 값이 아니라 해시를 키로 둡니다. Redis 를 들여다봐도 쿠키에 든 값은 알 수 없습니다.
 */
final class OpaqueTokens {

    private static final SecureRandom SECURE_RANDOM = new SecureRandom();
    private static final int TOKEN_BYTES = 32;

    private OpaqueTokens() {
    }

    /** 32바이트 무작위 값의 base64url 입니다. 43자라 PKCE code_verifier 길이 조건(43~128)에도 맞습니다. */
    static String random() {
        byte[] bytes = new byte[TOKEN_BYTES];
        SECURE_RANDOM.nextBytes(bytes);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }

    /** SHA-256 의 base64url 입니다. PKCE code_challenge(S256)도 이 값입니다. */
    static String sha256(String value) {
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256")
                    .digest(value.getBytes(StandardCharsets.US_ASCII));
            return Base64.getUrlEncoder().withoutPadding().encodeToString(digest);
        } catch (NoSuchAlgorithmException exception) {
            throw new IllegalStateException("SHA-256 is unavailable", exception);
        }
    }
}
