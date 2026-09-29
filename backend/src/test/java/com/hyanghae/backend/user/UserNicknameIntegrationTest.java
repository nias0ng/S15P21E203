package com.hyanghae.backend.user;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.hyanghae.backend.auth.dto.request.LoginRequest;
import com.hyanghae.backend.auth.exception.AuthErrorCode;
import com.hyanghae.backend.support.FakeEmailVerificationMailSender;
import com.hyanghae.backend.support.IntegrationTest;
import com.hyanghae.backend.support.SignupTestHelper;
import com.hyanghae.backend.user.dto.request.NicknameChangeRequest;
import com.hyanghae.backend.user.repository.UserRepository;
import static org.junit.jupiter.api.Named.named;

import java.util.stream.Stream;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.MethodSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.data.redis.core.RedisCallback;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

/**
 * 닉네임 변경 API 를 실제 PostgreSQL 위에서 검증합니다.
 *
 * <p>가입과 로그인을 실제로 거쳐 토큰을 받습니다. 닉네임 변경은 로그인한 사람이 자기 것만
 * 바꾸는 동작이라, 누가 요청했는지를 대역으로 정하면 검증할 것이 남지 않습니다.
 */
@IntegrationTest
@AutoConfigureMockMvc
@TestPropertySource(properties = "hyanghae.auth.enforce-http-authorization=true")
class UserNicknameIntegrationTest {

    private static final String NICKNAME_URL = "/api/v1/users/me/nickname";
    private static final String ME_URL = "/api/v1/users/me";

    private static final String EMAIL = "sailor@example.com";
    private static final String PASSWORD = "password123";
    private static final String NICKNAME = "향해자";
    private static final String NEW_NICKNAME = "바다지기";

    @Autowired
    MockMvc mockMvc;

    @Autowired
    ObjectMapper objectMapper;

    @Autowired
    UserRepository userRepository;

    @Autowired
    StringRedisTemplate redisTemplate;

    @Autowired
    FakeEmailVerificationMailSender mailSender;

    @BeforeEach
    void setUp() {
        userRepository.deleteAll();
        redisTemplate.execute((RedisCallback<Void>) connection -> {
            connection.serverCommands().flushDb();
            return null;
        });
    }

    /** 바꾼 값을 그대로 돌려주고, 이후 조회에도 반영됩니다. */
    @Test
    void changesNickname() throws Exception {
        String accessToken = signupAndLogin(EMAIL, NICKNAME);

        mockMvc.perform(patch(NICKNAME_URL)
                        .header(HttpHeaders.AUTHORIZATION, bearer(accessToken))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(new NicknameChangeRequest(NEW_NICKNAME))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.nickname").value(NEW_NICKNAME))
                .andExpect(jsonPath("$.email").value(EMAIL))
                .andExpect(jsonPath("$.userId").exists());

        mockMvc.perform(get(ME_URL).header(HttpHeaders.AUTHORIZATION, bearer(accessToken)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.nickname").value(NEW_NICKNAME));
    }

    /**
     * 로그인 세션이 그대로 살아 있습니다.
     *
     * <p>비밀번호 변경은 자격 증명이 바뀌어 전 세션을 끊지만 닉네임은 인증과 무관합니다.
     * 여기서 끊으면 이름만 바꿔도 다시 로그인해야 합니다.
     */
    @Test
    void keepsSessionAfterChange() throws Exception {
        String accessToken = signupAndLogin(EMAIL, NICKNAME);

        changeNickname(accessToken, NEW_NICKNAME).andExpect(status().isOk());

        mockMvc.perform(get(ME_URL).header(HttpHeaders.AUTHORIZATION, bearer(accessToken)))
                .andExpect(status().isOk());
    }

    /**
     * 지금 쓰는 닉네임을 그대로 보내면 성공입니다.
     *
     * <p>중복 검사를 그냥 거치면 자기 닉네임에 걸려 409 가 납니다. 화면에서 닉네임을 안 고친
     * 채 저장을 눌렀을 때 실패하면 안 됩니다.
     */
    @Test
    void acceptsUnchangedNickname() throws Exception {
        String accessToken = signupAndLogin(EMAIL, NICKNAME);

        changeNickname(accessToken, NICKNAME)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.nickname").value(NICKNAME));
    }

    /** 다른 사람이 쓰고 있는 닉네임은 409 입니다. */
    @Test
    void rejectsNicknameTakenByAnotherUser() throws Exception {
        signupAndLogin("first@example.com", NICKNAME);
        String accessToken = signupAndLogin("second@example.com", NEW_NICKNAME);

        changeNickname(accessToken, NICKNAME)
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code")
                        .value(AuthErrorCode.AUTH_NICKNAME_ALREADY_EXISTS.code()));
    }

    /** 앞뒤 공백은 지우고 저장합니다. 가입과 같은 규칙입니다. */
    @Test
    void trimsSurroundingWhitespace() throws Exception {
        String accessToken = signupAndLogin(EMAIL, NICKNAME);

        changeNickname(accessToken, "  " + NEW_NICKNAME + "  ")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.nickname").value(NEW_NICKNAME));
    }

    /**
     * 공백을 지운 뒤 2~20자를 벗어나면 400 입니다.
     *
     * <p>길이를 {@code repeat} 으로 만듭니다. 한글 스무 자짜리 리터럴은 눈으로 세기 어려워
     * 경계를 한 칸 틀리기 쉽습니다.
     */
    @ParameterizedTest
    @MethodSource("nicknamesOutOfLength")
    void rejectsNicknameOutOfLength(String nickname) throws Exception {
        String accessToken = signupAndLogin(EMAIL, NICKNAME);

        changeNickname(accessToken, nickname).andExpect(status().isBadRequest());
    }

    private static Stream<Arguments> nicknamesOutOfLength() {
        return Stream.of(
                Arguments.of(named("한 자", "가")),
                Arguments.of(named("공백을 지우면 한 자", "  가  ")),
                Arguments.of(named("스물한 자", "가".repeat(21))),
                Arguments.of(named("전부 공백", "   "))
        );
    }

    /** 경계인 두 자와 스무 자는 받습니다. */
    @ParameterizedTest
    @MethodSource("nicknamesAtLengthBoundary")
    void acceptsNicknameAtLengthBoundary(String nickname) throws Exception {
        String accessToken = signupAndLogin(EMAIL, NICKNAME);

        changeNickname(accessToken, nickname)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.nickname").value(nickname));
    }

    private static Stream<Arguments> nicknamesAtLengthBoundary() {
        return Stream.of(
                Arguments.of(named("두 자", "가".repeat(2))),
                Arguments.of(named("스무 자", "가".repeat(20)))
        );
    }

    /** 로그인하지 않으면 401 입니다. */
    @Test
    void rejectsAnonymousRequest() throws Exception {
        mockMvc.perform(patch(NICKNAME_URL)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(new NicknameChangeRequest(NEW_NICKNAME))))
                .andExpect(status().isUnauthorized());
    }

    private org.springframework.test.web.servlet.ResultActions changeNickname(
            String accessToken, String nickname) throws Exception {
        return mockMvc.perform(patch(NICKNAME_URL)
                .header(HttpHeaders.AUTHORIZATION, bearer(accessToken))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"nickname\":\"" + nickname + "\"}"));
    }

    private String signupAndLogin(String email, String nickname) throws Exception {
        new SignupTestHelper(mockMvc, objectMapper, mailSender).signup(email, PASSWORD, nickname);

        MvcResult result = mockMvc.perform(post("/api/v1/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(new LoginRequest(email, PASSWORD))))
                .andExpect(status().isOk())
                .andReturn();
        JsonNode response = objectMapper.readTree(result.getResponse().getContentAsString());
        return response.get("accessToken").asText();
    }

    private String json(Object value) throws Exception {
        return objectMapper.writeValueAsString(value);
    }

    private String bearer(String accessToken) {
        return "Bearer " + accessToken;
    }
}
