package com.hyanghae.backend.auth.service;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.HashSet;
import java.util.Random;
import java.util.Set;
import org.junit.jupiter.api.Test;

class EmailVerificationSecretsTest {

    private final EmailVerificationSecrets secrets = new EmailVerificationSecrets();

    @Test
    void keepsLeadingZerosInSevenDigits() {
        assertThat(EmailVerificationSecrets.formatCode(42)).isEqualTo("0000042");
        assertThat(EmailVerificationSecrets.formatCode(0)).isEqualTo("0000000");
        assertThat(EmailVerificationSecrets.formatCode(9_999_999)).isEqualTo("9999999");
    }

    /** 난수의 양 끝이 나와도 7자리 숫자입니다. 범위를 한 칸 틀리면 8자리나 음수가 섞입니다. */
    @Test
    void codeCoversBothEndsOfRange() {
        assertThat(new EmailVerificationSecrets(fixedRandom(0)).newCode()).isEqualTo("0000000");
        assertThat(new EmailVerificationSecrets(fixedRandom(9_999_999)).newCode())
                .isEqualTo("9999999");
    }

    @Test
    void generatedCodesAreAlwaysSevenDigits() {
        for (int index = 0; index < 1_000; index++) {
            assertThat(secrets.newCode()).matches("^\\d{7}$");
        }
    }

    @Test
    void storesHashInsteadOfCode() {
        String hash = secrets.hash("0123456");

        assertThat(hash).doesNotContain("0123456").matches("^[0-9a-f]{64}$");
        assertThat(secrets.hash("0123456")).isEqualTo(hash);
        assertThat(secrets.hash("0123457")).isNotEqualTo(hash);
    }

    @Test
    void matchesOnlySameCode() {
        String hash = secrets.hash("0123456");

        assertThat(secrets.matches("0123456", hash)).isTrue();
        assertThat(secrets.matches("123456", hash)).isFalse();
        assertThat(secrets.matches("0123457", hash)).isFalse();
    }

    /** 32바이트를 패딩 없는 base64url 로 담으면 43자이고, URL·Redis 키에 그대로 넣을 수 있습니다. */
    @Test
    void tokensAreUrlSafeAndUnique() {
        Set<String> tokens = new HashSet<>();
        for (int index = 0; index < 100; index++) {
            String token = secrets.newToken();
            assertThat(token).hasSize(43).matches("^[A-Za-z0-9_-]+$");
            tokens.add(token);
        }
        assertThat(tokens).hasSize(100);
    }

    private Random fixedRandom(int value) {
        return new Random() {
            @Override
            public int nextInt(int bound) {
                return value;
            }
        };
    }
}
