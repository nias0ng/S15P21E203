package com.hyanghae.backend.auth.exception;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.Arrays;
import org.junit.jupiter.api.Test;

class AuthErrorCodeTest {

    @Test
    void allCodesUseAuthPrefix() {
        assertThat(Arrays.stream(AuthErrorCode.values()).map(AuthErrorCode::code))
                .allMatch(code -> code.startsWith("AUTH_"));
    }
}
