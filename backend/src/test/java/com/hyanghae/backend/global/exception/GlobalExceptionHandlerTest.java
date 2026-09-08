package com.hyanghae.backend.global.exception;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.nio.charset.StandardCharsets;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.springframework.boot.test.system.CapturedOutput;
import org.springframework.boot.test.system.OutputCaptureExtension;
import org.springframework.http.HttpStatus;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * 예외 처리 골자의 계약을 고정합니다. 앞으로 만들 API가 전부 이 핸들러에 의존하므로,
 * 응답 형식·상태 코드·로그 수준이 바뀌면 여기서 먼저 깨져야 합니다.
 *
 * <p>핸들러는 {@link ErrorCode} 인터페이스만 알면 되므로, 특정 도메인의 에러 코드를 가져다 쓰지 않고
 * 테스트 전용 구현({@link TestErrorCode})으로 검증합니다. 도메인 쪽 에러 코드가 바뀌어도
 * 이 테스트는 영향을 받지 않아야 합니다.
 *
 * <p>Spring 컨텍스트나 DB 없이 도는 단위 테스트입니다. Docker가 필요하지 않습니다.
 */
@ExtendWith(OutputCaptureExtension.class)
class GlobalExceptionHandlerTest {

    /** 로그에는 남아야 하지만 응답 본문으로는 절대 나가면 안 되는 값입니다. */
    private static final String INTERNAL_DETAIL = "internal-detail-must-not-leak";

    private MockMvc mockMvc;

    @BeforeEach
    void setUp() {
        mockMvc = MockMvcBuilders.standaloneSetup(new TestController())
                .setControllerAdvice(new GlobalExceptionHandler())
                .build();
    }

    @Test
    void mapsBusinessExceptionToErrorCodeStatusWithoutStackTrace(CapturedOutput output) throws Exception {
        mockMvc.perform(get("/test/business"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value(TestErrorCode.TEST_NOT_FOUND.code()))
                .andExpect(jsonPath("$.message").value(TestErrorCode.TEST_NOT_FOUND.message()));

        assertThat(output)
                .contains("Business exception handled: errorCode=TEST_NOT_FOUND, status=404")
                .doesNotContain("ERROR")
                .doesNotContain(BusinessException.class.getName());
    }

    @Test
    void logsStackTraceForUnexpectedExceptionButHidesDetailFromResponse(CapturedOutput output) throws Exception {
        MvcResult result = mockMvc.perform(get("/test/unexpected"))
                .andExpect(status().isInternalServerError())
                .andExpect(jsonPath("$.code").value("INTERNAL_ERROR"))
                .andReturn();

        String body = result.getResponse().getContentAsString(StandardCharsets.UTF_8);
        assertThat(body).doesNotContain(INTERNAL_DETAIL);

        // RequestIdFilter 는 여기서 처리된 예외를 보지 못하므로, 원인 추적은 이 로그가 유일한 근거입니다.
        assertThat(output)
                .contains("ERROR")
                .contains("Unexpected exception handled: exceptionType=java.lang.IllegalStateException")
                .contains(INTERNAL_DETAIL)
                .contains("at com.hyanghae.backend");
    }

    @Test
    void mapsUnsupportedMethodTo405InsteadOfServerError(CapturedOutput output) throws Exception {
        mockMvc.perform(post("/test/business"))
                .andExpect(status().isMethodNotAllowed())
                .andExpect(jsonPath("$.code").value("METHOD_NOT_ALLOWED"));

        assertThat(output)
                .contains("status=405")
                .doesNotContain("ERROR");
    }

    @Test
    void mapsPathVariableTypeMismatchTo400InsteadOfServerError(CapturedOutput output) throws Exception {
        mockMvc.perform(get("/test/items/abc"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("BAD_REQUEST"));

        assertThat(output)
                .contains("status=400")
                .doesNotContain("ERROR");
    }

    /** 핸들러 계약 검증에만 쓰는 에러 코드입니다. 실제 도메인 코드와 무관합니다. */
    private enum TestErrorCode implements ErrorCode {

        TEST_NOT_FOUND(HttpStatus.NOT_FOUND, "대상을 찾을 수 없습니다.");

        private final HttpStatus status;
        private final String message;

        TestErrorCode(HttpStatus status, String message) {
            this.status = status;
            this.message = message;
        }

        @Override
        public HttpStatus status() {
            return status;
        }

        @Override
        public String message() {
            return message;
        }
    }

    /**
     * 예외를 던지기 위한 테스트 전용 컨트롤러입니다. 테스트 안에서만 등록되므로
     * 실제 애플리케이션에는 이 경로가 존재하지 않습니다.
     */
    @RestController
    @RequestMapping("/test")
    static class TestController {

        @GetMapping("/business")
        String business() {
            throw new BusinessException(TestErrorCode.TEST_NOT_FOUND);
        }

        @GetMapping("/unexpected")
        String unexpected() {
            throw new IllegalStateException(INTERNAL_DETAIL);
        }

        @GetMapping("/items/{itemId}")
        String typed(@PathVariable Long itemId) {
            return "ok";
        }
    }
}
