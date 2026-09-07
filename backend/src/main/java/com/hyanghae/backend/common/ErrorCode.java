package com.hyanghae.backend.common;

import org.springframework.http.HttpStatus;

/**
 * 도메인별 에러 코드 enum이 구현하는 규격입니다.
 *
 * <p>에러 코드는 도메인마다 자기 패키지에 {@code XxxErrorCode} enum을 만들어 정의합니다.
 * 모든 도메인이 하나의 enum을 공유하면 팀원들이 같은 파일을 동시에 고치게 되어
 * 머지 충돌이 반복되기 때문입니다.
 *
 * <p>{@link #code()}는 enum 상수 이름을 그대로 쓰므로, 상수 이름에 도메인을 붙여
 * 다른 도메인과 겹치지 않게 합니다. 예: {@code PERFUME_NOT_FOUND}, {@code USER_NOT_FOUND}.
 * 서로 다른 enum이라 컴파일러가 중복을 잡아주지 못하므로 규칙으로 지켜야 합니다.
 */
public interface ErrorCode {

    HttpStatus status();

    String code();

    String message();
}
