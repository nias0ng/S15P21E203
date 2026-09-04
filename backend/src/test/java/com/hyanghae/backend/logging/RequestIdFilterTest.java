package com.hyanghae.backend.logging;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import jakarta.servlet.ServletException;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.slf4j.MDC;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;

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
    void removesRequestIdFromMdcWhenRequestFails() {
        MockHttpServletRequest request = new MockHttpServletRequest();
        MockHttpServletResponse response = new MockHttpServletResponse();

        assertThatThrownBy(() -> requestIdFilter.doFilter(
                request,
                response,
                (servletRequest, servletResponse) -> {
                    throw new ServletException("request failed");
                }
        )).isInstanceOf(ServletException.class);

        assertThat(MDC.get(RequestIdFilter.MDC_KEY)).isNull();
    }
}
