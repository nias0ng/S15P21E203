package com.hyanghae.backend.auth.config;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.time.Duration;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.bind.DefaultValue;
import org.springframework.validation.annotation.Validated;

@Validated
@ConfigurationProperties(prefix = "hyanghae.auth")
public record AuthProperties(
        @DefaultValue("30m") @NotNull Duration accessTokenTtl,
        @DefaultValue("7d") @NotNull Duration refreshTokenTtl,
        @DefaultValue("2") @Min(1) int maxSessionsPerUser,
        @DefaultValue("hyanghae") @NotBlank String issuer,
        @DefaultValue("") String jwtSecret,
        @DefaultValue("true") boolean enforceHttpAuthorization,
        @DefaultValue @Valid @NotNull Cookie cookie,
        @DefaultValue @Valid @NotNull Google google
) {

    public record Cookie(
            @DefaultValue("refresh_token") @NotBlank String name,
            @DefaultValue("true") boolean secure,
            @DefaultValue("Strict") @NotBlank String sameSite
    ) {
    }

    /**
     * Google 로그인(OAuth 2.0 Authorization Code) 설정입니다.
     *
     * <p>셋 중 하나라도 비어 있으면 Google 로그인을 쓰지 않는 것으로 보고, 시작하려 하면 로그인 화면으로
     * 돌려보냅니다. 앱은 그대로 뜹니다 — Google 을 쓰지 않는 로컬·테스트 환경이 있습니다.
     *
     * @param clientId          Google Cloud 의 OAuth 클라이언트 ID(웹 애플리케이션)
     * @param clientSecret      같은 클라이언트의 보안 비밀. code 를 토큰으로 바꿀 때만 씁니다
     * @param redirectUri       Google 이 code 를 들려 돌려보낼 주소. 콘솔의 "승인된 리디렉션 URI"와
     *                          글자 하나까지 같아야 합니다
     * @param authorizationTtl  Google 로그인 화면에 머무를 수 있는 시간
     * @param signupTicketTtl   Google 확인을 마친 뒤 닉네임을 정해 가입을 끝낼 때까지 주는 시간
     */
    public record Google(
            @DefaultValue("") String clientId,
            @DefaultValue("") String clientSecret,
            @DefaultValue("") String redirectUri,
            @DefaultValue("10m") @NotNull Duration authorizationTtl,
            @DefaultValue("10m") @NotNull Duration signupTicketTtl
    ) {

        public boolean enabled() {
            return !isBlank(clientId) && !isBlank(clientSecret) && !isBlank(redirectUri);
        }

        private static boolean isBlank(String value) {
            return value == null || value.isBlank();
        }
    }
}
