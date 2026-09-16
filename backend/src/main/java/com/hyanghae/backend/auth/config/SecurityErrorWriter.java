package com.hyanghae.backend.auth.config;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.hyanghae.backend.auth.exception.AuthErrorCode;
import com.hyanghae.backend.global.response.ApiErrorResponse;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;

@Component
public class SecurityErrorWriter {

    private final ObjectMapper objectMapper;

    public SecurityErrorWriter(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
    }

    public void write(HttpServletResponse response, AuthErrorCode errorCode) throws IOException {
        response.setStatus(errorCode.status().value());
        response.setContentType(MediaType.APPLICATION_JSON_VALUE);
        response.setCharacterEncoding("UTF-8");
        objectMapper.writeValue(
                response.getWriter(),
                new ApiErrorResponse(errorCode.code(), errorCode.message())
        );
    }
}
