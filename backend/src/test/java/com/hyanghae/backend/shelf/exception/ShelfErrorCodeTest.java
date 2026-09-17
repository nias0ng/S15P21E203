package com.hyanghae.backend.shelf.exception;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

class ShelfErrorCodeTest {

    private static final String DOMAIN_PREFIX = "SHELF_";

    @Test
    void everyCodeIsPrefixedWithDomainName() {
        assertThat(ShelfErrorCode.values())
                .isNotEmpty()
                .allSatisfy(errorCode ->
                        assertThat(errorCode.code()).startsWith(DOMAIN_PREFIX)
                );
    }
}
