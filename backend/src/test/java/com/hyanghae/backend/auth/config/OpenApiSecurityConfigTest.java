package com.hyanghae.backend.auth.config;

import static org.assertj.core.api.Assertions.assertThat;

import io.swagger.v3.oas.annotations.enums.SecuritySchemeType;
import io.swagger.v3.oas.annotations.security.SecurityScheme;
import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.Operation;
import io.swagger.v3.oas.models.PathItem;
import io.swagger.v3.oas.models.Paths;
import java.time.Duration;
import org.junit.jupiter.api.Test;
import org.springdoc.core.customizers.OpenApiCustomizer;

class OpenApiSecurityConfigTest {

    private final OpenApiSecurityConfig config = new OpenApiSecurityConfig();

    @Test
    void registersBearerJwtSecurityScheme() {
        SecurityScheme scheme = OpenApiSecurityConfig.class.getAnnotation(SecurityScheme.class);

        assertThat(scheme.name()).isEqualTo("bearerAuth");
        assertThat(scheme.type()).isEqualTo(SecuritySchemeType.HTTP);
        assertThat(scheme.scheme()).isEqualTo("bearer");
        assertThat(scheme.bearerFormat()).isEqualTo("JWT");
    }

    @Test
    void marksOnlyEndpointsThatRequireAuthentication() {
        Operation myCollections = new Operation();
        Operation publicPerfumes = new Operation();
        Operation publicRecommendation = new Operation();
        Operation publicLogin = new Operation();
        Operation protectedWrite = new Operation();
        OpenAPI openApi = new OpenAPI().paths(new Paths()
                .addPathItem("/api/v1/users/me/collections", new PathItem().get(myCollections))
                .addPathItem("/api/v1/perfumes", new PathItem().get(publicPerfumes))
                .addPathItem("/api/v1/recommendations", new PathItem().post(publicRecommendation))
                .addPathItem("/api/v1/auth/login", new PathItem().post(publicLogin))
                .addPathItem("/api/v1/posts", new PathItem().post(protectedWrite)));

        OpenApiCustomizer customizer = config.authenticationRequirements(properties(true));
        customizer.customise(openApi);

        assertThat(myCollections.getSecurity())
                .singleElement()
                .satisfies(requirement -> assertThat(requirement).containsKey("bearerAuth"));
        assertThat(protectedWrite.getSecurity())
                .singleElement()
                .satisfies(requirement -> assertThat(requirement).containsKey("bearerAuth"));
        assertThat(publicPerfumes.getSecurity()).isNull();
        assertThat(publicRecommendation.getSecurity()).isNull();
        assertThat(publicLogin.getSecurity()).isNull();
    }

    @Test
    void omitsRequirementsWhenHttpAuthorizationIsDisabled() {
        Operation operation = new Operation();
        OpenAPI openApi = new OpenAPI().paths(new Paths()
                .addPathItem("/api/v1/users/me", new PathItem().get(operation)));

        config.authenticationRequirements(properties(false)).customise(openApi);

        assertThat(operation.getSecurity()).isNull();
    }

    private AuthProperties properties(boolean enforceHttpAuthorization) {
        return new AuthProperties(
                Duration.ofMinutes(30),
                Duration.ofDays(7),
                2,
                "hyanghae",
                "test-jwt-secret-must-be-at-least-thirty-two-bytes",
                enforceHttpAuthorization,
                new AuthProperties.Cookie("refresh_token", false, "Strict"),
                new AuthProperties.Google("", "", "", Duration.ofMinutes(10), Duration.ofMinutes(10))
        );
    }
}
