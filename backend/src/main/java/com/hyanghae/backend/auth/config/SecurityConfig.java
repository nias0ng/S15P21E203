package com.hyanghae.backend.auth.config;

import com.hyanghae.backend.auth.exception.AuthErrorCode;
import com.hyanghae.backend.auth.service.AuthSessionStore;
import com.nimbusds.jose.jwk.source.ImmutableSecret;
import com.nimbusds.jose.proc.SecurityContext;
import java.nio.charset.StandardCharsets;
import javax.crypto.SecretKey;
import javax.crypto.spec.SecretKeySpec;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.oauth2.core.DelegatingOAuth2TokenValidator;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.JwtEncoder;
import org.springframework.security.oauth2.jwt.JwtValidators;
import org.springframework.security.oauth2.jwt.NimbusJwtDecoder;
import org.springframework.security.oauth2.jwt.NimbusJwtEncoder;
import org.springframework.security.web.SecurityFilterChain;

@Configuration(proxyBeanMethods = false)
@EnableConfigurationProperties(AuthProperties.class)
public class SecurityConfig {

    @Bean
    SecurityFilterChain securityFilterChain(
            HttpSecurity http,
            AuthProperties properties,
            SecurityErrorWriter errorWriter
    ) throws Exception {
        http
                .csrf(csrf -> csrf.disable())
                .sessionManagement(session -> session
                        .sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .authorizeHttpRequests(authorize -> {
                    authorize
                            .requestMatchers(
                                    "/actuator/health",
                                    "/actuator/prometheus",
                                    "/v3/api-docs/**",
                                    "/swagger-ui/**",
                                    "/swagger-ui.html"
                            ).permitAll()
                            .requestMatchers(
                                    "/api/v1/auth/signup",
                                    "/api/v1/auth/login",
                                    "/api/v1/auth/refresh",
                                    "/api/v1/auth/google/authorize",
                                    "/api/v1/auth/google/callback",
                                    "/api/v1/auth/google/signup"
                            ).permitAll()
                            // 가입 화면에서 쓰므로 로그인 전에 열려 있어야 합니다.
                            .requestMatchers(
                                    HttpMethod.GET,
                                    "/api/v1/users/nickname-availability",
                                    "/api/v1/users/email-availability"
                            ).permitAll();

                    if (properties.enforceHttpAuthorization()) {
                        authorize
                                .requestMatchers(
                                        "/api/v1/users/me/**",
                                        "/api/v1/auth/logout",
                                        "/api/v1/auth/google/reauth",
                                        "/api/v1/perfume-views/**",
                                        "/api/v1/recommendations/personalized",
                                        "/api/v1/recommendations/personalized/**",
                                        "/api/v1/map/exploration/**",
                                        "/api/v1/map/exploration-logs"
                                ).authenticated()
                                .requestMatchers(HttpMethod.GET, "/api/v1/**").permitAll()
                                // HEAD 는 본문 없는 GET 입니다. Spring MVC 가 @GetMapping
                                // 핸들러로 처리하므로 GET 을 연 곳은 HEAD 도 열어야 짝이
                                // 맞습니다. 닫아 두면 게시글 이미지처럼 크기·형식만 확인하려는
                                // 쪽(링크 미리보기 수집기, 캐시 앞단)이 401 을 받습니다.
                                //
                                // 위의 authenticated() 뒤에 두는 순서가 중요합니다. 앞에 두면
                                // HEAD /api/v1/users/me 가 인증 없이 열립니다.
                                .requestMatchers(HttpMethod.HEAD, "/api/v1/**").permitAll()
                                .requestMatchers(HttpMethod.POST, "/api/v1/recommendations/**")
                                .permitAll()
                                .anyRequest().authenticated();
                    } else {
                        authorize.anyRequest().permitAll();
                    }
                })
                .oauth2ResourceServer(resourceServer -> resourceServer
                        .jwt(Customizer.withDefaults())
                        .authenticationEntryPoint((request, response, exception) ->
                                errorWriter.write(response, AuthErrorCode.AUTH_LOGIN_REQUIRED)))
                .exceptionHandling(exceptions -> exceptions
                        .authenticationEntryPoint((request, response, exception) ->
                                errorWriter.write(response, AuthErrorCode.AUTH_LOGIN_REQUIRED))
                        .accessDeniedHandler((request, response, exception) ->
                                errorWriter.write(response, AuthErrorCode.AUTH_ACCESS_DENIED)));
        return http.build();
    }

    @Bean
    JwtEncoder jwtEncoder(AuthProperties properties) {
        return new NimbusJwtEncoder(
                new ImmutableSecret<SecurityContext>(secretKey(properties))
        );
    }

    @Bean
    JwtDecoder jwtDecoder(AuthProperties properties, AuthSessionStore sessionStore) {
        NimbusJwtDecoder decoder = NimbusJwtDecoder.withSecretKey(secretKey(properties))
                .macAlgorithm(MacAlgorithm.HS256)
                .build();
        decoder.setJwtValidator(new DelegatingOAuth2TokenValidator<>(
                JwtValidators.createDefaultWithIssuer(properties.issuer()),
                new ActiveSessionJwtValidator(sessionStore)
        ));
        return decoder;
    }

    @Bean
    org.springframework.security.crypto.password.PasswordEncoder passwordEncoder() {
        return new org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder();
    }

    private SecretKey secretKey(AuthProperties properties) {
        byte[] secret = properties.jwtSecret().getBytes(StandardCharsets.UTF_8);
        if (secret.length < 32) {
            throw new IllegalStateException("JWT_SECRET must contain at least 32 bytes");
        }
        return new SecretKeySpec(secret, "HmacSHA256");
    }
}
