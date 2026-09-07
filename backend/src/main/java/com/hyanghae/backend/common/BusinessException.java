package com.hyanghae.backend.common;

/**
 * 서비스가 의도적으로 던지는 예외입니다.
 * {@link GlobalExceptionHandler}가 {@link ErrorCode}를 읽어 상태 코드와 응답 본문을 만듭니다.
 *
 * <p>도메인마다 예외 클래스를 새로 만들 필요는 없습니다. {@code ErrorCode}가 상태·코드·메시지를
 * 모두 들고 있으므로 이 클래스 하나로 충분합니다. 예외를 따로 잡아야 하거나 추가 데이터를
 * 실어야 할 때만 상속받아 만듭니다.
 */
public class BusinessException extends RuntimeException {

    private final transient ErrorCode errorCode;

    public BusinessException(ErrorCode errorCode) {
        super(errorCode.message());
        this.errorCode = errorCode;
    }

    public ErrorCode getErrorCode() {
        return errorCode;
    }
}
