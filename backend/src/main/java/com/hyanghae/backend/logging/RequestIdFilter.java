package com.hyanghae.backend.logging;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.slf4j.MDC;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;
import org.springframework.web.servlet.HandlerMapping;

@Component
public class RequestIdFilter extends OncePerRequestFilter {

    private static final Logger log = LoggerFactory.getLogger(RequestIdFilter.class);
    static final String MDC_KEY = "requestId";
    static final String RESPONSE_HEADER = "X-Request-ID";

    @Override
    protected void doFilterInternal(
            HttpServletRequest request,
            HttpServletResponse response,
            FilterChain filterChain
    ) throws ServletException, IOException {
        String requestId = UUID.randomUUID().toString();

        MDC.put(MDC_KEY, requestId);
        response.setHeader(RESPONSE_HEADER, requestId);

        long startedAt = System.nanoTime();
        boolean completed = false;
        try {
            filterChain.doFilter(request, response);
            completed = true;
        } finally {
            try {
                int status = !completed && response.getStatus() < 400
                        ? HttpServletResponse.SC_INTERNAL_SERVER_ERROR
                        : response.getStatus();
                log.info(
                        "HTTP request completed: method={}, path={}, status={}, durationMs={}",
                        request.getMethod(),
                        getPathPattern(request),
                        status,
                        (System.nanoTime() - startedAt) / 1_000_000
                );
            } finally {
                MDC.remove(MDC_KEY);
            }
        }
    }

    private String getPathPattern(HttpServletRequest request) {
        Object pathPattern = request.getAttribute(HandlerMapping.BEST_MATCHING_PATTERN_ATTRIBUTE);
        return pathPattern == null ? "<unmatched>" : pathPattern.toString();
    }
}
