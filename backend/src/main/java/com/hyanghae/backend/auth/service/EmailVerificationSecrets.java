package com.hyanghae.backend.auth.service;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.util.Base64;
import java.util.HexFormat;
import java.util.Locale;
import java.util.Random;
import org.springframework.stereotype.Component;

/**
 * 이메일 인증번호와 인증 토큰을 만들고, 저장용 해시를 계산합니다.
 *
 * <p>Redis 에는 인증번호 원문을 두지 않습니다. 저장소를 들여다볼 수 있는 사람이 그 번호로
 * 남의 이메일을 인증하지 못하게 하려는 것입니다.
 */
@Component
public class EmailVerificationSecrets {

    private static final int CODE_BOUND = 10_000_000;
    private static final int TOKEN_BYTES = 32;

    private final Random random;

    public EmailVerificationSecrets() {
        this(new SecureRandom());
    }

    // 테스트가 값이 정해진 난수로 경계값(0, 9999999)을 확인하려고 엽니다.
    EmailVerificationSecrets(Random random) {
        this.random = random;
    }

    public String newCode() {
        return formatCode(random.nextInt(CODE_BOUND));
    }

    /** 앞자리 0 을 지우면 7자리 입력칸과 맞지 않아, 늘 7자리로 채웁니다. */
    static String formatCode(int value) {
        return String.format(Locale.ROOT, "%07d", value);
    }

    public String newToken() {
        byte[] bytes = new byte[TOKEN_BYTES];
        random.nextBytes(bytes);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }

    public String hash(String code) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            return HexFormat.of().formatHex(digest.digest(code.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException exception) {
            throw new IllegalStateException("SHA-256 is not available", exception);
        }
    }

    /** 비교에 걸리는 시간으로 몇 글자가 맞았는지 새지 않게 고정 시간 비교를 씁니다. */
    public boolean matches(String code, String storedHash) {
        return MessageDigest.isEqual(
                hash(code).getBytes(StandardCharsets.US_ASCII),
                storedHash.getBytes(StandardCharsets.US_ASCII)
        );
    }
}
