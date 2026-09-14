package com.hyanghae.backend.global.logging;

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
    /**
     * 로그 패턴이 읽는 MDC 키입니다.
     *
     * <p>공개해 둔 이유는 요청이 아닌 실행도 이 키를 채워야 하기 때문입니다. 스케줄 배치는 자기
     * 스레드에서 도는데, 키 문자열을 각자 적어 두면 한쪽만 바뀌었을 때 그 로그의
     * {@code requestId} 가 조용히 비게 됩니다.
     */
    public static final String MDC_KEY = "requestId";
    static final String RESPONSE_HEADER = "X-Request-ID";
    private static final String PROMETHEUS_PATH = "/actuator/prometheus";

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        return (request.getContextPath() + PROMETHEUS_PATH).equals(request.getRequestURI());
    }

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
        } catch (ServletException | IOException | RuntimeException exception) {
            log.error(
                    "Unhandled HTTP request exception: method={}, path={}, exceptionType={}",
                    request.getMethod(),
                    getPathPattern(request),
                    exception.getClass().getName(),
                    exception
            );
            throw exception;
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
