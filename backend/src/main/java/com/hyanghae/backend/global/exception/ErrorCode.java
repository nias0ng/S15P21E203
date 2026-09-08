package com.hyanghae.backend.global.exception;

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
 * 도메인별 테스트가 접두사 규칙을 강제합니다.
 */
public interface ErrorCode {

    HttpStatus status();

    String message();

    /**
     * enum 상수 이름입니다. 구현할 필요가 없습니다 — 모든 enum이 이미 갖고 있는
     * {@link Enum#name()}이 이 계약을 충족합니다.
     *
     * <p>여기 선언해 두면 enum이 아닌 클래스는 이 인터페이스를 구현할 때 컴파일 에러가 납니다.
     * {@link #code()}가 enum 이름에 의존하므로, 그 전제를 주석이 아니라 컴파일러로 지키기 위한 선언입니다.
     */
    String name();

    /**
     * 클라이언트가 분기에 쓰는 에러 식별자입니다.
     *
     * <p>상수 이름을 그대로 쓰므로 손으로 관리하는 코드 문자열이 없습니다. 별도 필드를 두면
     * 상수 이름을 바꿀 때 따라오지 않거나 값이 중복되는 사고가 생깁니다.
     */
    default String code() {
        return name();
    }
}
