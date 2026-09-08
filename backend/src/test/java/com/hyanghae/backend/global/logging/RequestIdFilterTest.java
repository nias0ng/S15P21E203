package com.hyanghae.backend.global.logging;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import jakarta.servlet.ServletException;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.slf4j.MDC;
import org.springframework.boot.test.system.CapturedOutput;
import org.springframework.boot.test.system.OutputCaptureExtension;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.web.servlet.HandlerMapping;

@ExtendWith(OutputCaptureExtension.class)
class RequestIdFilterTest {

    private final RequestIdFilter requestIdFilter = new RequestIdFilter();

    @AfterEach
    void clearMdc() {
        MDC.clear();
    }

    @Test
    void addsRequestIdToMdcAndResponseHeader() throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest();
        MockHttpServletResponse response = new MockHttpServletResponse();
        AtomicReference<String> requestIdInChain = new AtomicReference<>();

        requestIdFilter.doFilter(request, response, (servletRequest, servletResponse) ->
                requestIdInChain.set(MDC.get(RequestIdFilter.MDC_KEY))
        );

        String responseRequestId = response.getHeader(RequestIdFilter.RESPONSE_HEADER);
        assertThat(responseRequestId).isEqualTo(requestIdInChain.get());
        assertThat(UUID.fromString(responseRequestId)).isNotNull();
        assertThat(MDC.get(RequestIdFilter.MDC_KEY)).isNull();
    }

    @Test
    void removesRequestIdFromMdcAndLogsServerErrorWhenRequestFails(CapturedOutput output) {
        MockHttpServletRequest request = new MockHttpServletRequest(
                "POST",
                "/api/reviews/sensitive-review-id"
        );
        request.setQueryString("token=sensitive-token");
        request.setAttribute(
                HandlerMapping.BEST_MATCHING_PATTERN_ATTRIBUTE,
                "/api/reviews/{reviewId}"
        );
        MockHttpServletResponse response = new MockHttpServletResponse();

        assertThatThrownBy(() -> requestIdFilter.doFilter(
                request,
                response,
                (servletRequest, servletResponse) -> {
                    throw new ServletException("request failed");
                }
        )).isInstanceOf(ServletException.class);

        assertThat(MDC.get(RequestIdFilter.MDC_KEY)).isNull();
        assertThat(output)
                .contains("ERROR")
                .contains("path=/api/reviews/{reviewId}")
                .contains("exceptionType=jakarta.servlet.ServletException")
                .contains("request failed")
                .contains("status=500")
                .doesNotContain("sensitive-review-id")
                .doesNotContain("sensitive-token");
    }

    @Test
    void logsSafeRequestMetadataWithoutActualPathOrQueryString(CapturedOutput output) throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest(
                "POST",
                "/api/reviews/sensitive-review-id"
        );
        request.setQueryString("token=sensitive-token");
        request.setAttribute(
                HandlerMapping.BEST_MATCHING_PATTERN_ATTRIBUTE,
                "/api/reviews/{reviewId}"
        );
        MockHttpServletResponse response = new MockHttpServletResponse();
        response.setStatus(201);

        requestIdFilter.doFilter(request, response, (servletRequest, servletResponse) -> {
        });

        assertThat(output)
                .contains("method=POST")
                .contains("path=/api/reviews/{reviewId}")
                .contains("status=201")
                .contains("durationMs=")
                .doesNotContain("sensitive-review-id")
                .doesNotContain("sensitive-token");
    }

    @Test
    void skipsRequestLoggingForPrometheusScrapes(CapturedOutput output) throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest(
                "GET",
                "/actuator/prometheus"
        );
        MockHttpServletResponse response = new MockHttpServletResponse();

        requestIdFilter.doFilter(request, response, (servletRequest, servletResponse) -> {
        });

        assertThat(response.getHeader(RequestIdFilter.RESPONSE_HEADER)).isNull();
        assertThat(output).doesNotContain("HTTP request completed");
    }
}
