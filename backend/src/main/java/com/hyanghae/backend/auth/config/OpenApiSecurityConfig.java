package com.hyanghae.backend.auth.config;

import io.swagger.v3.oas.annotations.enums.SecuritySchemeType;
import io.swagger.v3.oas.annotations.security.SecurityScheme;
import io.swagger.v3.oas.models.PathItem;
import io.swagger.v3.oas.models.security.SecurityRequirement;
import org.springdoc.core.customizers.OpenApiCustomizer;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration(proxyBeanMethods = false)
@SecurityScheme(
        name = OpenApiSecurityConfig.BEARER_AUTH,
        type = SecuritySchemeType.HTTP,
        scheme = "bearer",
        bearerFormat = "JWT",
        description = "로그인 응답의 accessToken을 입력하세요. Bearer 접두사는 Swagger UI가 자동으로 추가합니다."
)
public class OpenApiSecurityConfig {

    static final String BEARER_AUTH = "bearerAuth";

    @Bean
    OpenApiCustomizer authenticationRequirements(AuthProperties properties) {
        return openApi -> {
            if (!properties.enforceHttpAuthorization() || openApi.getPaths() == null) {
                return;
            }

            openApi.getPaths().forEach((path, pathItem) ->
                    pathItem.readOperationsMap().forEach((method, operation) -> {
                        if (requiresAuthentication(method, path)) {
                            operation.addSecurityItem(
                                    new SecurityRequirement().addList(BEARER_AUTH)
                            );
                        }
                    })
            );
        };
    }

    private boolean requiresAuthentication(PathItem.HttpMethod method, String path) {
        if (isPublicAuthEndpoint(path)
                || (method == PathItem.HttpMethod.GET
                && path.equals("/api/v1/users/nickname-availability"))) {
            return false;
        }

        if (isAlwaysAuthenticatedEndpoint(path)) {
            return true;
        }

        if (method == PathItem.HttpMethod.GET && path.startsWith("/api/v1/")) {
            return false;
        }

        return method != PathItem.HttpMethod.POST
                || !matchesPathTree(path, "/api/v1/recommendations");
    }

    private boolean isPublicAuthEndpoint(String path) {
        return path.equals("/api/v1/auth/signup")
                || path.equals("/api/v1/auth/login")
                || path.equals("/api/v1/auth/refresh");
    }

    private boolean isAlwaysAuthenticatedEndpoint(String path) {
        return matchesPathTree(path, "/api/v1/users/me")
                || path.equals("/api/v1/auth/logout")
                || matchesPathTree(path, "/api/v1/perfume-views")
                || matchesPathTree(path, "/api/v1/map/exploration")
                || path.equals("/api/v1/map/exploration-logs");
    }

    private boolean matchesPathTree(String path, String root) {
        return path.equals(root) || path.startsWith(root + "/");
    }
}
