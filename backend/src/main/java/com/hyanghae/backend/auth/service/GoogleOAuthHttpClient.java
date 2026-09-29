package com.hyanghae.backend.auth.service;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import com.hyanghae.backend.auth.config.AuthProperties;
import com.hyanghae.backend.auth.exception.AuthErrorCode;
import com.hyanghae.backend.global.exception.BusinessException;
import java.time.Duration;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.web.client.RestTemplateBuilder;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestTemplate;

/**
 * Google 토큰 엔드포인트에 code 를 보내 ID 토큰을 받습니다.
 *
 * <p>Access Token 은 받지만 쓰지 않습니다. 필요한 것은 "이 사람이 이 Google 계정의 주인"이라는 사실뿐이고,
 * 그것은 ID 토큰에 들어 있습니다. Google API 를 대신 부를 일이 없어 저장하지도 않습니다.
 */
@Component
public class GoogleOAuthHttpClient implements GoogleOAuthClient {

    private static final Logger log = LoggerFactory.getLogger(GoogleOAuthHttpClient.class);

    static final String TOKEN_URI = "https://oauth2.googleapis.com/token";

    /** 사용자가 Google 에서 돌아와 기다리는 요청이라 짧게 끊습니다. */
    private static final Duration TIMEOUT = Duration.ofSeconds(5);

    private final AuthProperties.Google properties;
    private final GoogleIdTokenVerifier idTokenVerifier;
    private final RestTemplate restTemplate;

    public GoogleOAuthHttpClient(
            AuthProperties properties,
            GoogleIdTokenVerifier idTokenVerifier,
            RestTemplateBuilder restTemplateBuilder
    ) {
        this.properties = properties.google();
        this.idTokenVerifier = idTokenVerifier;
        this.restTemplate = restTemplateBuilder
                .connectTimeout(TIMEOUT)
                .readTimeout(TIMEOUT)
                .build();
    }

    @Override
    public GoogleIdentity exchange(String code, String codeVerifier, String expectedNonce) {
        MultiValueMap<String, String> form = new LinkedMultiValueMap<>();
        form.add("grant_type", "authorization_code");
        form.add("code", code);
        form.add("client_id", properties.clientId());
        form.add("client_secret", properties.clientSecret());
        form.add("redirect_uri", properties.redirectUri());
        form.add("code_verifier", codeVerifier);
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_FORM_URLENCODED);

        TokenResponse response;
        try {
            response = restTemplate.postForObject(
                    TOKEN_URI, new HttpEntity<>(form, headers), TokenResponse.class);
        } catch (HttpClientErrorException exception) {
            // code 가 만료됐거나 이미 쓰였거나, redirect_uri · client 설정이 콘솔과 다른 경우입니다.
            // 본문에 code 가 되돌아올 수 있어 상태 코드만 남깁니다.
            log.warn("event=google_token_exchange_rejected, status={}",
                    exception.getStatusCode().value());
            throw new BusinessException(AuthErrorCode.AUTH_GOOGLE_LOGIN_FAILED);
        } catch (RestClientException exception) {
            log.warn("event=google_token_exchange_unavailable, exception={}",
                    exception.getClass().getSimpleName());
            throw new BusinessException(AuthErrorCode.AUTH_GOOGLE_LOGIN_UNAVAILABLE);
        }

        if (response == null || response.idToken() == null || response.idToken().isBlank()) {
            throw new BusinessException(AuthErrorCode.AUTH_GOOGLE_LOGIN_FAILED);
        }
        return idTokenVerifier.verify(response.idToken(), expectedNonce);
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    record TokenResponse(@JsonProperty("id_token") String idToken) {
    }
}
