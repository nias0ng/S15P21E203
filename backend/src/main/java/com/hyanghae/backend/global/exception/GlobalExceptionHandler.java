package com.hyanghae.backend.global.exception;

import com.hyanghae.backend.global.response.ApiErrorResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.HttpStatusCode;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.context.request.WebRequest;
import org.springframework.web.servlet.mvc.method.annotation.ResponseEntityExceptionHandler;

/**
 * 애플리케이션 전역의 예외를 {@link ApiErrorResponse} 형식으로 변환합니다.
 *
 * <p>{@link ResponseEntityExceptionHandler}를 상속하는 이유가 중요합니다. 이 부모 클래스가
 * Spring MVC 표준 예외(지원하지 않는 메서드, 없는 경로, 깨진 요청 본문 등)의 상태 코드 매핑을
 * 이미 갖고 있습니다. 상속하지 않고 {@code @ExceptionHandler(Exception.class)} 하나로 받으면
 * 클라이언트 잘못인 4xx까지 전부 500으로 기록되어, Loki에서 {@code status=5}로 장애를 찾을 때
 * 노이즈가 됩니다.
 *
 * <p><b>로깅 주의</b>: RequestIdFilter는 필터 체인 밖으로 새어나온 예외만 ERROR로 남깁니다.
 * 여기서 처리한 예외는 필터까지 올라가지 않으므로 필터의 ERROR 로그가 찍히지 않습니다.
 * 그래서 예상하지 못한 예외의 스택트레이스는 이 클래스가 직접 남겨야 합니다.
 * 요청 단위 접근 로그는 필터가 이미 남기므로 여기서 중복으로 남기지 않습니다.
 */
@RestControllerAdvice
public class GlobalExceptionHandler extends ResponseEntityExceptionHandler {

    private static final Logger log = LoggerFactory.getLogger(GlobalExceptionHandler.class);

    private static final String FALLBACK_CODE = "UNKNOWN";
    private static final String BAD_REQUEST_MESSAGE = "요청을 처리할 수 없습니다.";
    private static final String INTERNAL_ERROR_CODE = "INTERNAL_ERROR";
    private static final String INTERNAL_ERROR_MESSAGE = "서버 오류가 발생했습니다.";

    /**
     * 서비스가 의도적으로 던진 예외입니다. 예상된 흐름이므로 스택트레이스는 남기지 않습니다.
     */
    @ExceptionHandler(BusinessException.class)
    public ResponseEntity<ApiErrorResponse> handleBusinessException(BusinessException exception) {
        ErrorCode errorCode = exception.errorCode();

        log.warn(
                "Business exception handled: errorCode={}, status={}",
                errorCode.code(),
                errorCode.status().value()
        );

        return ResponseEntity.status(errorCode.status())
                .body(new ApiErrorResponse(errorCode.code(), errorCode.message()));
    }

    /**
     * 위에서 걸러지지 않은 모든 예외입니다. 원인을 추적할 수 있는 유일한 지점이므로
     * 반드시 스택트레이스를 남깁니다. 클라이언트에는 내부 정보를 내보내지 않습니다.
     */
    @ExceptionHandler(Exception.class)
    public ResponseEntity<ApiErrorResponse> handleUnexpectedException(Exception exception) {
        log.error(
                "Unexpected exception handled: exceptionType={}",
                exception.getClass().getName(),
                exception
        );

        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(new ApiErrorResponse(INTERNAL_ERROR_CODE, INTERNAL_ERROR_MESSAGE));
    }

    /**
     * 부모가 처리하는 Spring MVC 표준 예외의 응답 본문만 우리 형식으로 바꿉니다.
     * 상태 코드는 부모가 정한 값을 그대로 씁니다.
     *
     * <p>코드는 상태 이름(BAD_REQUEST, METHOD_NOT_ALLOWED 등)을 그대로 사용하고,
     * 메시지는 고정 문구만 내보냅니다. 예외 메시지를 그대로 담으면 내부 구조나 사용자 입력이
     * 클라이언트로 새어나갑니다.
     */
    @Override
    protected ResponseEntity<Object> handleExceptionInternal(
            Exception exception,
            Object body,
            HttpHeaders headers,
            HttpStatusCode statusCode,
            WebRequest request
    ) {
        HttpStatus resolved = HttpStatus.resolve(statusCode.value());
        String code = resolved == null ? FALLBACK_CODE : resolved.name();

        if (statusCode.is5xxServerError()) {
            log.error(
                    "Spring MVC exception handled: exceptionType={}, status={}",
                    exception.getClass().getName(),
                    statusCode.value(),
                    exception
            );
        } else {
            log.warn(
                    "Request rejected: exceptionType={}, status={}",
                    exception.getClass().getSimpleName(),
                    statusCode.value()
            );
        }

        ApiErrorResponse errorResponse = new ApiErrorResponse(
                statusCode.is5xxServerError() ? INTERNAL_ERROR_CODE : code,
                statusCode.is5xxServerError() ? INTERNAL_ERROR_MESSAGE : BAD_REQUEST_MESSAGE
        );

        return super.handleExceptionInternal(exception, errorResponse, headers, statusCode, request);
    }
}
