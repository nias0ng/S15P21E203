package com.hyanghae.backend.community.exception;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

/**
 * 커뮤니티 도메인 에러 코드의 계약을 고정합니다.
 *
 * <p>응답의 {@code code}는 enum 상수 이름이 그대로 나가므로, 다른 도메인의 에러 코드와 겹치면
 * 프론트엔드가 에러를 구분할 수 없습니다. 서로 다른 enum이라 컴파일러가 중복을 잡아주지 못해
 * 이 테스트가 접두사 규칙을 강제합니다.
 */
class CommunityErrorCodeTest {

    private static final String DOMAIN_PREFIX = "COMMUNITY_";

    @Test
    void everyCodeIsPrefixedWithDomainName() {
        assertThat(CommunityErrorCode.values())
                .isNotEmpty()
                .allSatisfy(errorCode ->
                        assertThat(errorCode.code()).startsWith(DOMAIN_PREFIX)
                );
    }
}
