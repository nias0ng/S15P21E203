package com.hyanghae.backend.auth;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.hyanghae.backend.auth.dto.request.GoogleSignupRequest;
import com.hyanghae.backend.auth.dto.request.LoginRequest;
import com.hyanghae.backend.auth.dto.request.SignupRequest;
import com.hyanghae.backend.auth.exception.AuthErrorCode;
import com.hyanghae.backend.auth.service.GoogleIdentity;
import com.hyanghae.backend.auth.service.GoogleOAuthClient;
import com.hyanghae.backend.global.exception.BusinessException;
import com.hyanghae.backend.support.IntegrationTest;
import com.hyanghae.backend.user.dto.request.PasswordChangeRequest;
import com.hyanghae.backend.user.dto.request.UserDeleteRequest;
import com.hyanghae.backend.user.entity.User;
import com.hyanghae.backend.user.repository.UserRepository;
import jakarta.servlet.http.Cookie;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.Base64;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Primary;
import org.springframework.data.redis.core.RedisCallback;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.util.MultiValueMap;
import org.springframework.web.util.UriComponentsBuilder;

/**
 * Google 로그인 화면을 거쳐 돌아오는 흐름입니다. Google 토큰 엔드포인트는 가짜로 바꿔 끼우고,
 * ID 토큰 검증은 {@code GoogleIdTokenVerifierTest} 가 따로 봅니다.
 */
@IntegrationTest
@AutoConfigureMockMvc
@TestPropertySource(properties = {
        "hyanghae.auth.enforce-http-authorization=true",
        "hyanghae.auth.google.client-id=" + GoogleAuthIntegrationTest.CLIENT_ID,
        "hyanghae.auth.google.client-secret=test-secret",
        "hyanghae.auth.google.redirect-uri=" + GoogleAuthIntegrationTest.REDIRECT_URI
})
class GoogleAuthIntegrationTest {

    static final String CLIENT_ID = "hyanghae-test.apps.googleusercontent.com";
    static final String REDIRECT_URI = "http://localhost:5173/api/v1/auth/google/callback";

    private static final String STATE_COOKIE = "google_oauth_state";
    private static final String TICKET_COOKIE = "google_signup_ticket";
    private static final String REFRESH_COOKIE = "refresh_token";

    private static final String SAILOR_CODE = "code-sailor";
    private static final String OTHER_CODE = "code-other";
    private static final String UNVERIFIED_CODE = "code-unverified";
    private static final GoogleIdentity SAILOR =
            new GoogleIdentity("108234567890123456789", "sailor@gmail.com", "향해자");
    private static final GoogleIdentity OTHER =
            new GoogleIdentity("109876543210987654321", "other@gmail.com", "다른선원");

    @Autowired
    MockMvc mockMvc;

    @Autowired
    ObjectMapper objectMapper;

    @Autowired
    UserRepository userRepository;

    @Autowired
    StringRedisTemplate redisTemplate;

    @Autowired
    FakeGoogle fakeGoogle;

    @BeforeEach
    void setUp() {
        userRepository.deleteAll();
        redisTemplate.execute((RedisCallback<Void>) connection -> {
            connection.serverCommands().flushDb();
            return null;
        });
    }

    @Test
    void newUserSignsUpThroughGoogleAndLogsInDirectlyNextTime() throws Exception {
        Started started = authorize("/shelf?stage=collection");

        // Google 로그인 화면으로 보냅니다. PKCE 와 nonce 를 싣습니다.
        MultiValueMap<String, String> query = started.query();
        assertThat(started.location()).startsWith("https://accounts.google.com/o/oauth2/v2/auth?");
        assertThat(query.getFirst("client_id")).isEqualTo(CLIENT_ID);
        assertThat(query.getFirst("redirect_uri")).isEqualTo(REDIRECT_URI);
        assertThat(query.getFirst("response_type")).isEqualTo("code");
        assertThat(query.getFirst("code_challenge_method")).isEqualTo("S256");
        assertThat(query.getFirst("nonce")).isNotBlank();
        assertThat(started.stateCookieHeader())
                .contains("HttpOnly", "SameSite=Lax", "Path=/api/v1/auth/google");

        MvcResult callback = callback(started, SAILOR_CODE);

        // 처음 온 사람이라 닉네임 화면으로 갑니다. 가입표는 주소가 아니라 쿠키로 갑니다.
        assertThat(location(callback))
                .isEqualTo("/signup/google?redirectTo=%2Fshelf%3Fstage%3Dcollection");
        Cookie ticket = callback.getResponse().getCookie(TICKET_COOKIE);
        assertThat(ticket).isNotNull();
        assertThat(ticket.getValue()).isNotBlank();
        assertThat(callback.getResponse().getCookie(REFRESH_COOKIE)).isNull();
        assertThat(callback.getResponse().getCookie(STATE_COOKIE).getMaxAge()).isZero();
        assertThat(userRepository.count()).isZero();
        // 토큰 엔드포인트에는 시작할 때 만든 verifier 와 nonce 가 갑니다.
        assertThat(challengeOf(fakeGoogle.lastVerifier))
                .isEqualTo(query.getFirst("code_challenge"));
        assertThat(fakeGoogle.lastNonce).isEqualTo(query.getFirst("nonce"));

        mockMvc.perform(get("/api/v1/auth/google/signup").cookie(ticket))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.email").value(SAILOR.email()))
                .andExpect(jsonPath("$.suggestedNickname").value("향해자"));

        String accessToken = signup(ticket, "  새선원 ");
        mockMvc.perform(get("/api/v1/users/me")
                        .header(HttpHeaders.AUTHORIZATION, bearer(accessToken)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.email").value(SAILOR.email()))
                .andExpect(jsonPath("$.nickname").value("새선원"))
                .andExpect(jsonPath("$.hasPassword").value(false))
                .andExpect(jsonPath("$.googleConnected").value(true));
        User saved = userRepository.findByGoogleSubject(SAILOR.subject()).orElseThrow();
        assertThat(saved.getPasswordHash()).isNull();

        // 같은 가입표로는 다시 가입할 수 없습니다.
        mockMvc.perform(post("/api/v1/auth/google/signup")
                        .cookie(ticket)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(new GoogleSignupRequest("또다른선원"))))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code")
                        .value(AuthErrorCode.AUTH_INVALID_GOOGLE_SIGNUP_TICKET.code()));

        // 두 번째부터는 콜백에서 바로 로그인됩니다. 화면은 Refresh Token 으로 Access Token 을 받습니다.
        MvcResult again = callback(authorize("/shelf"), SAILOR_CODE);
        assertThat(location(again)).isEqualTo("/login/google?redirectTo=%2Fshelf");
        Cookie refresh = again.getResponse().getCookie(REFRESH_COOKIE);
        assertThat(refresh).isNotNull();
        assertThat(refresh.isHttpOnly()).isTrue();
        mockMvc.perform(post("/api/v1/auth/refresh").cookie(refresh))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.accessToken").isNotEmpty());
    }

    /**
     * 남이 자기 code 를 담은 콜백 링크를 보내 피해자를 자기 계정으로 로그인시키는 공격입니다. 로그인을
     * 시작한 브라우저의 쿠키가 없으면 받지 않습니다.
     */
    @Test
    void rejectsCallbackFromBrowserThatDidNotStartLogin() throws Exception {
        Started started = authorize(null);

        MvcResult withoutCookie = mockMvc.perform(get("/api/v1/auth/google/callback")
                        .param("state", started.state())
                        .param("code", SAILOR_CODE))
                .andExpect(status().isFound())
                .andReturn();
        assertThat(location(withoutCookie))
                .isEqualTo("/login?googleError=AUTH_GOOGLE_LOGIN_FAILED");

        MvcResult otherCookie = mockMvc.perform(get("/api/v1/auth/google/callback")
                        .cookie(new Cookie(STATE_COOKIE, "someone-elses-state"))
                        .param("state", started.state())
                        .param("code", SAILOR_CODE))
                .andExpect(status().isFound())
                .andReturn();
        assertThat(location(otherCookie))
                .isEqualTo("/login?googleError=AUTH_GOOGLE_LOGIN_FAILED");
        assertThat(fakeGoogle.lastVerifier).isNull();
    }

    @Test
    void sameStateCannotBeUsedTwice() throws Exception {
        Started started = authorize(null);
        callback(started, SAILOR_CODE);

        assertThat(location(callback(started, SAILOR_CODE)))
                .isEqualTo("/login?googleError=AUTH_GOOGLE_LOGIN_FAILED");
    }

    @Test
    void sendsBackToLoginWhenUserCancelsOnGoogle() throws Exception {
        Started started = authorize("/shelf");

        MvcResult result = mockMvc.perform(get("/api/v1/auth/google/callback")
                        .cookie(started.stateCookie())
                        .param("state", started.state())
                        .param("error", "access_denied"))
                .andExpect(status().isFound())
                .andReturn();

        assertThat(location(result))
                .isEqualTo("/login?googleError=AUTH_GOOGLE_LOGIN_CANCELLED&redirectTo=%2Fshelf");
    }

    /** 이미 이메일로 가입한 사람의 계정에 Google 을 몰래 이어 붙이지 않습니다. */
    @Test
    void rejectsGoogleLoginWhenEmailIsRegisteredWithPassword() throws Exception {
        passwordSignup(SAILOR.email(), "기존선원");

        MvcResult result = callback(authorize(null), SAILOR_CODE);

        assertThat(location(result))
                .isEqualTo("/login?googleError=AUTH_EMAIL_REGISTERED_WITH_PASSWORD");
        assertThat(result.getResponse().getCookie(TICKET_COOKIE)).isNull();
        assertThat(userRepository.findByEmail(SAILOR.email()).orElseThrow().getGoogleSubject())
                .isNull();
    }

    @Test
    void rejectsGoogleAccountWithUnverifiedEmail() throws Exception {
        assertThat(location(callback(authorize(null), UNVERIFIED_CODE)))
                .isEqualTo("/login?googleError=AUTH_GOOGLE_EMAIL_NOT_VERIFIED");
    }

    /** 바깥 주소로 돌려보내는 통로가 되지 않게, 화면 안의 경로가 아니면 버립니다. */
    @Test
    void dropsReturnPathThatLeavesTheSite() throws Exception {
        MvcResult first = callback(authorize("//evil.example.com"), SAILOR_CODE);

        assertThat(location(first)).isEqualTo("/signup/google");
    }

    /** 닉네임이 겹쳐도 Google 로그인부터 다시 하지 않고 다른 닉네임으로 이어 갑니다. */
    @Test
    void keepsSignupTicketWhenNicknameIsTaken() throws Exception {
        passwordSignup("someone@example.com", "향해자");
        Cookie ticket = callback(authorize(null), SAILOR_CODE).getResponse().getCookie(TICKET_COOKIE);

        mockMvc.perform(post("/api/v1/auth/google/signup")
                        .cookie(ticket)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(new GoogleSignupRequest("향해자"))))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code")
                        .value(AuthErrorCode.AUTH_NICKNAME_ALREADY_EXISTS.code()));

        signup(ticket, "새선원");
    }

    @Test
    void rejectsSignupWithoutTicket() throws Exception {
        mockMvc.perform(get("/api/v1/auth/google/signup"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code")
                        .value(AuthErrorCode.AUTH_INVALID_GOOGLE_SIGNUP_TICKET.code()));
        mockMvc.perform(post("/api/v1/auth/google/signup")
                        .cookie(new Cookie(TICKET_COOKIE, "made-up-ticket"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(new GoogleSignupRequest("새선원"))))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code")
                        .value(AuthErrorCode.AUTH_INVALID_GOOGLE_SIGNUP_TICKET.code()));
    }

    @Test
    void googleUserCannotUsePasswordFeatures() throws Exception {
        String accessToken = signUpWithGoogle(SAILOR_CODE, "새선원");

        // 비밀번호가 없는 계정은 없는 계정과 같은 답을 받습니다.
        mockMvc.perform(post("/api/v1/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(new LoginRequest(SAILOR.email(), "password123"))))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code")
                        .value(AuthErrorCode.AUTH_INVALID_CREDENTIALS.code()));

        mockMvc.perform(patch("/api/v1/users/me/password")
                        .header(HttpHeaders.AUTHORIZATION, bearer(accessToken))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(new PasswordChangeRequest("password123", "newPassword123"))))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value(AuthErrorCode.AUTH_PASSWORD_NOT_SET.code()));
    }

    @Test
    void googleUserWithdrawsAfterConfirmingSameGoogleAccount() throws Exception {
        String accessToken = signUpWithGoogle(SAILOR_CODE, "새선원");

        // 로그인 세션만으로는 탈퇴할 수 없습니다.
        withdraw(accessToken)
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code")
                        .value(AuthErrorCode.AUTH_GOOGLE_REAUTH_REQUIRED.code()));

        mockMvc.perform(post("/api/v1/auth/google/reauth"))
                .andExpect(status().isUnauthorized());

        // 다른 Google 계정으로는 확인되지 않습니다.
        assertThat(location(callback(reauth(accessToken), OTHER_CODE)))
                .isEqualTo("/account?googleReauth=AUTH_GOOGLE_ACCOUNT_MISMATCH");
        withdraw(accessToken).andExpect(status().isBadRequest());

        assertThat(location(callback(reauth(accessToken), SAILOR_CODE)))
                .isEqualTo("/account?googleReauth=ok");
        withdraw(accessToken).andExpect(status().isNoContent());

        assertThat(userRepository.findByGoogleSubject(SAILOR.subject())).isEmpty();
        mockMvc.perform(get("/api/v1/users/me")
                        .header(HttpHeaders.AUTHORIZATION, bearer(accessToken)))
                .andExpect(status().isUnauthorized());
    }

    private Started authorize(String returnTo) throws Exception {
        var request = get("/api/v1/auth/google/authorize");
        if (returnTo != null) {
            request.param("redirectTo", returnTo);
        }
        MvcResult result = mockMvc.perform(request).andExpect(status().isFound()).andReturn();
        return started(result);
    }

    private Started reauth(String accessToken) throws Exception {
        MvcResult result = mockMvc.perform(post("/api/v1/auth/google/reauth")
                        .header(HttpHeaders.AUTHORIZATION, bearer(accessToken)))
                .andExpect(status().isOk())
                .andReturn();
        String url = read(result).get("authorizationUrl").asText();
        return new Started(url, result.getResponse().getCookie(STATE_COOKIE),
                result.getResponse().getHeader(HttpHeaders.SET_COOKIE));
    }

    private Started started(MvcResult result) {
        return new Started(
                location(result),
                result.getResponse().getCookie(STATE_COOKIE),
                result.getResponse().getHeader(HttpHeaders.SET_COOKIE)
        );
    }

    private MvcResult callback(Started started, String code) throws Exception {
        return mockMvc.perform(get("/api/v1/auth/google/callback")
                        .cookie(started.stateCookie())
                        .param("state", started.state())
                        .param("code", code))
                .andExpect(status().isFound())
                .andReturn();
    }

    private String signUpWithGoogle(String code, String nickname) throws Exception {
        Cookie ticket = callback(authorize(null), code).getResponse().getCookie(TICKET_COOKIE);
        return signup(ticket, nickname);
    }

    private String signup(Cookie ticket, String nickname) throws Exception {
        MvcResult result = mockMvc.perform(post("/api/v1/auth/google/signup")
                        .cookie(ticket)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(new GoogleSignupRequest(nickname))))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.refreshToken").doesNotExist())
                .andReturn();
        Cookie refresh = result.getResponse().getCookie(REFRESH_COOKIE);
        assertThat(refresh).isNotNull();
        assertThat(refresh.getValue()).isNotBlank();
        assertThat(result.getResponse().getCookie(TICKET_COOKIE).getMaxAge()).isZero();
        return read(result).get("accessToken").asText();
    }

    private org.springframework.test.web.servlet.ResultActions withdraw(String accessToken)
            throws Exception {
        return mockMvc.perform(delete("/api/v1/users/me")
                .header(HttpHeaders.AUTHORIZATION, bearer(accessToken))
                .contentType(MediaType.APPLICATION_JSON)
                .content(json(new UserDeleteRequest(null))));
    }

    private void passwordSignup(String email, String nickname) throws Exception {
        mockMvc.perform(post("/api/v1/auth/signup")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(new SignupRequest(email, "password123", nickname))))
                .andExpect(status().isCreated());
    }

    private static String challengeOf(String verifier) throws Exception {
        byte[] digest = MessageDigest.getInstance("SHA-256")
                .digest(verifier.getBytes(StandardCharsets.US_ASCII));
        return Base64.getUrlEncoder().withoutPadding().encodeToString(digest);
    }

    private static String location(MvcResult result) {
        return result.getResponse().getHeader(HttpHeaders.LOCATION);
    }

    private JsonNode read(MvcResult result) throws Exception {
        return objectMapper.readTree(result.getResponse().getContentAsString());
    }

    private String json(Object value) throws Exception {
        return objectMapper.writeValueAsString(value);
    }

    private String bearer(String accessToken) {
        return "Bearer " + accessToken;
    }

    private record Started(String location, Cookie stateCookie, String stateCookieHeader) {

        MultiValueMap<String, String> query() {
            return UriComponentsBuilder.fromUriString(location).build().getQueryParams();
        }

        String state() {
            return query().getFirst("state");
        }
    }

    /** Google 토큰 엔드포인트 대신입니다. 받은 code 로 계정을 정하고, 넘어온 verifier · nonce 를 남깁니다. */
    static class FakeGoogle implements GoogleOAuthClient {

        private static final Map<String, GoogleIdentity> IDENTITIES =
                Map.of(SAILOR_CODE, SAILOR, OTHER_CODE, OTHER);

        volatile String lastVerifier;
        volatile String lastNonce;

        @Override
        public GoogleIdentity exchange(String code, String codeVerifier, String expectedNonce) {
            lastVerifier = codeVerifier;
            lastNonce = expectedNonce;
            if (UNVERIFIED_CODE.equals(code)) {
                throw new BusinessException(AuthErrorCode.AUTH_GOOGLE_EMAIL_NOT_VERIFIED);
            }
            GoogleIdentity identity = IDENTITIES.get(code);
            if (identity == null) {
                throw new BusinessException(AuthErrorCode.AUTH_GOOGLE_LOGIN_FAILED);
            }
            return identity;
        }
    }

    @TestConfiguration
    static class FakeGoogleConfig {

        @Bean
        @Primary
        FakeGoogle fakeGoogle() {
            return new FakeGoogle();
        }
    }

    @BeforeEach
    void resetFakeGoogle() {
        fakeGoogle.lastVerifier = null;
        fakeGoogle.lastNonce = null;
    }
}
