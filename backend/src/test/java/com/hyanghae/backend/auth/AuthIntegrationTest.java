package com.hyanghae.backend.auth;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.cookie;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.hyanghae.backend.auth.dto.request.LoginRequest;
import com.hyanghae.backend.auth.dto.request.SignupRequest;
import com.hyanghae.backend.auth.exception.AuthErrorCode;
import com.hyanghae.backend.support.FakeEmailVerificationMailSender;
import com.hyanghae.backend.support.IntegrationTest;
import com.hyanghae.backend.support.SignupTestHelper;
import com.hyanghae.backend.user.dto.request.PasswordChangeRequest;
import com.hyanghae.backend.user.dto.request.UserDeleteRequest;
import com.hyanghae.backend.user.entity.User;
import com.hyanghae.backend.user.repository.UserRepository;
import jakarta.servlet.http.Cookie;
import java.nio.charset.StandardCharsets;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.RedisCallback;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

@IntegrationTest
@AutoConfigureMockMvc
@TestPropertySource(properties = "hyanghae.auth.enforce-http-authorization=true")
class AuthIntegrationTest {

    private static final String EMAIL = "sailor@example.com";
    private static final String PASSWORD = "password123";
    private static final String NEW_PASSWORD = "changedPassword123";
    private static final String REFRESH_COOKIE = "refresh_token";

    @Autowired
    MockMvc mockMvc;

    @Autowired
    ObjectMapper objectMapper;

    @Autowired
    UserRepository userRepository;

    @Autowired
    PasswordEncoder passwordEncoder;

    @Autowired
    StringRedisTemplate redisTemplate;

    @Autowired
    FakeEmailVerificationMailSender mailSender;

    SignupTestHelper signupHelper;

    @BeforeEach
    void setUp() {
        signupHelper = new SignupTestHelper(mockMvc, objectMapper, mailSender);
        mailSender.clear();
        userRepository.deleteAll();
        redisTemplate.execute((RedisCallback<Void>) connection -> {
            connection.serverCommands().flushDb();
            return null;
        });
    }

    @Test
    void signsUpLogsInAndReadsCurrentUser() throws Exception {
        signupHelper.signup("  Sailor@Example.com ", PASSWORD, " 향해자 ")
                .andExpect(jsonPath("$.email").value(EMAIL))
                .andExpect(jsonPath("$.nickname").value("향해자"));

        User saved = userRepository.findByEmail(EMAIL).orElseThrow();
        assertThat(saved.getPasswordHash()).isNotEqualTo(PASSWORD);
        assertThat(passwordEncoder.matches(PASSWORD, saved.getPasswordHash())).isTrue();

        LoginResult login = login(PASSWORD);
        assertThat(login.refreshCookie().isHttpOnly()).isTrue();
        assertThat(login.refreshCookie().getValue()).isNotBlank();

        mockMvc.perform(get("/api/v1/users/me")
                        .header(HttpHeaders.AUTHORIZATION, bearer(login.accessToken())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.userId").value(saved.getId()))
                .andExpect(jsonPath("$.email").value(EMAIL))
                .andExpect(jsonPath("$.nickname").value("향해자"));
    }

    @Test
    void rotatesRefreshTokenAndRejectsReuse() throws Exception {
        signup();
        LoginResult login = login(PASSWORD);

        MvcResult refreshed = mockMvc.perform(post("/api/v1/auth/refresh")
                        .cookie(login.refreshCookie()))
                .andExpect(status().isOk())
                .andExpect(cookie().exists(REFRESH_COOKIE))
                .andReturn();

        Cookie rotated = refreshed.getResponse().getCookie(REFRESH_COOKIE);
        assertThat(rotated).isNotNull();
        assertThat(rotated.getValue()).isNotEqualTo(login.refreshCookie().getValue());

        mockMvc.perform(post("/api/v1/auth/refresh").cookie(login.refreshCookie()))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code")
                        .value(AuthErrorCode.AUTH_INVALID_REFRESH_TOKEN.code()));
    }

    @Test
    void logoutImmediatelyInvalidatesCurrentAccessToken() throws Exception {
        signup();
        LoginResult login = login(PASSWORD);

        mockMvc.perform(post("/api/v1/auth/logout")
                        .header(HttpHeaders.AUTHORIZATION, bearer(login.accessToken())))
                .andExpect(status().isNoContent())
                .andExpect(header().string(HttpHeaders.SET_COOKIE,
                        org.hamcrest.Matchers.containsString("Max-Age=0")));

        mockMvc.perform(get("/api/v1/users/me")
                        .header(HttpHeaders.AUTHORIZATION, bearer(login.accessToken())))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void thirdLoginRevokesOldestSession() throws Exception {
        signup();
        LoginResult first = login(PASSWORD);
        Thread.sleep(5);
        LoginResult second = login(PASSWORD);
        Thread.sleep(5);
        LoginResult third = login(PASSWORD);

        mockMvc.perform(get("/api/v1/users/me")
                        .header(HttpHeaders.AUTHORIZATION, bearer(first.accessToken())))
                .andExpect(status().isUnauthorized());
        mockMvc.perform(get("/api/v1/users/me")
                        .header(HttpHeaders.AUTHORIZATION, bearer(second.accessToken())))
                .andExpect(status().isOk());
        mockMvc.perform(get("/api/v1/users/me")
                        .header(HttpHeaders.AUTHORIZATION, bearer(third.accessToken())))
                .andExpect(status().isOk());
    }

    @Test
    void passwordChangeRevokesAllSessions() throws Exception {
        signup();
        LoginResult first = login(PASSWORD);
        LoginResult second = login(PASSWORD);

        mockMvc.perform(patch("/api/v1/users/me/password")
                        .header(HttpHeaders.AUTHORIZATION, bearer(second.accessToken()))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(new PasswordChangeRequest(PASSWORD, NEW_PASSWORD))))
                .andExpect(status().isNoContent());

        mockMvc.perform(get("/api/v1/users/me")
                        .header(HttpHeaders.AUTHORIZATION, bearer(first.accessToken())))
                .andExpect(status().isUnauthorized());
        mockMvc.perform(get("/api/v1/users/me")
                        .header(HttpHeaders.AUTHORIZATION, bearer(second.accessToken())))
                .andExpect(status().isUnauthorized());

        login(NEW_PASSWORD);
    }

    @Test
    void deletesUserAfterPasswordConfirmation() throws Exception {
        signup();
        LoginResult login = login(PASSWORD);

        mockMvc.perform(delete("/api/v1/users/me")
                        .header(HttpHeaders.AUTHORIZATION, bearer(login.accessToken()))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(new UserDeleteRequest("wrongPassword"))))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code")
                        .value(AuthErrorCode.AUTH_CURRENT_PASSWORD_MISMATCH.code()));

        mockMvc.perform(delete("/api/v1/users/me")
                        .header(HttpHeaders.AUTHORIZATION, bearer(login.accessToken()))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(new UserDeleteRequest(PASSWORD))))
                .andExpect(status().isNoContent());

        assertThat(userRepository.findByEmail(EMAIL)).isEmpty();
        mockMvc.perform(get("/api/v1/users/me")
                        .header(HttpHeaders.AUTHORIZATION, bearer(login.accessToken())))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void reportsNicknameAvailabilityAndRejectsDuplicateSignup() throws Exception {
        signup();

        mockMvc.perform(get("/api/v1/users/nickname-availability")
                        .param("nickname", "향해자"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.available").value(false));
        mockMvc.perform(get("/api/v1/users/nickname-availability")
                        .param("nickname", "새선원"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.available").value(true));

        // 이미 가입한 이메일은 인증번호를 받을 수도 없어, 토큰 검사보다 앞의 중복 검사를 봅니다.
        mockMvc.perform(post("/api/v1/auth/signup")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(new SignupRequest(
                                EMAIL, PASSWORD, "다른닉네임", "unverified-token"))))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code")
                        .value(AuthErrorCode.AUTH_EMAIL_ALREADY_EXISTS.code()));
    }

    /**
     * 이메일 중복 확인입니다. 가입 버튼을 눌러야 중복을 아는 것보다 입력 중에 알려주는 편이
     * 낫습니다.
     *
     * <p><b>가입과 같은 방식으로 다듬어 봅니다</b> — 앞뒤 공백을 떼고 소문자로 바꿉니다. 그러지
     * 않으면 대문자로 친 사람에게 "쓸 수 있다"고 해 놓고 가입에서 막습니다.
     */
    @Test
    void reportsEmailAvailability() throws Exception {
        signup();

        mockMvc.perform(get("/api/v1/users/email-availability").param("email", EMAIL))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.available").value(false));

        // 가입한 이메일을 대문자·공백 섞어 쳐도 같은 주소로 봅니다.
        mockMvc.perform(get("/api/v1/users/email-availability")
                        .param("email", "  " + EMAIL.toUpperCase(java.util.Locale.ROOT) + "  "))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.available").value(false));

        mockMvc.perform(get("/api/v1/users/email-availability")
                        .param("email", "somebody-else@example.com"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.available").value(true));
    }

    /**
     * 형식이 아닌 값에 "쓸 수 있습니다"라고 답하지 않습니다. 가입은 {@code @Email} 이 걸러
     * 주는데 이 조회는 걸러 주는 것이 없어 직접 봅니다.
     */
    @ParameterizedTest
    @ValueSource(strings = {"not-an-email", "  ", "@example.com", "a@b", "a b@example.com"})
    void rejectsInvalidEmailAvailabilityQueries(String email) throws Exception {
        mockMvc.perform(get("/api/v1/users/email-availability").param("email", email))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code")
                        .value(AuthErrorCode.AUTH_INVALID_EMAIL.code()));
    }

    @ParameterizedTest
    @ValueSource(strings = {"a", "abcdefghijklmnopqrstu", "   ", "  a  "})
    void rejectsInvalidNicknameAvailabilityQueries(String nickname) throws Exception {
        mockMvc.perform(get("/api/v1/users/nickname-availability")
                        .param("nickname", nickname))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code")
                        .value(AuthErrorCode.AUTH_INVALID_NICKNAME.code()));
    }

    private void signup() throws Exception {
        signupHelper.signup(EMAIL, PASSWORD, "향해자");
    }

    private LoginResult login(String password) throws Exception {
        MvcResult result = mockMvc.perform(post("/api/v1/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(new LoginRequest(EMAIL, password))))
                .andExpect(status().isOk())
                .andExpect(cookie().exists(REFRESH_COOKIE))
                .andExpect(jsonPath("$.refreshToken").doesNotExist())
                .andReturn();
        JsonNode response = objectMapper.readTree(result.getResponse().getContentAsString());
        return new LoginResult(
                response.get("accessToken").asText(),
                result.getResponse().getCookie(REFRESH_COOKIE)
        );
    }

    private String json(Object value) throws Exception {
        return objectMapper.writeValueAsString(value);
    }

    private String bearer(String accessToken) {
        return "Bearer " + accessToken;
    }

    private record LoginResult(String accessToken, Cookie refreshCookie) {
    }
}
