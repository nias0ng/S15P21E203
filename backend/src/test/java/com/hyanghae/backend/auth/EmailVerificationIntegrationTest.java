package com.hyanghae.backend.auth;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.hyanghae.backend.auth.dto.request.EmailVerificationConfirmRequest;
import com.hyanghae.backend.auth.dto.request.EmailVerificationRequest;
import com.hyanghae.backend.auth.exception.AuthErrorCode;
import com.hyanghae.backend.global.i18n.Language;
import com.hyanghae.backend.support.FakeEmailVerificationMailSender;
import com.hyanghae.backend.support.IntegrationTest;
import com.hyanghae.backend.support.SignupTestHelper;
import com.hyanghae.backend.user.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.system.CapturedOutput;
import org.springframework.boot.test.system.OutputCaptureExtension;
import org.springframework.data.redis.core.RedisCallback;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.http.MediaType;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;

/**
 * 회원가입 이메일 인증을 실제 Redis 위에서 검증합니다.
 *
 * <p>인가를 켠 채로 돌립니다. 두 경로가 로그인 없이 열려 있는지도 함께 확인하려는 것입니다.
 */
@IntegrationTest
@AutoConfigureMockMvc
@TestPropertySource(properties = "hyanghae.auth.enforce-http-authorization=true")
@ExtendWith(OutputCaptureExtension.class)
class EmailVerificationIntegrationTest {

    private static final String SEND_URL = "/api/v1/auth/email-verifications";
    private static final String CONFIRM_URL = "/api/v1/auth/email-verifications/confirm";

    private static final String EMAIL = "sailor@example.com";
    private static final String OTHER_EMAIL = "deckhand@example.com";
    private static final String PASSWORD = "password123";
    private static final String NICKNAME = "향해자";

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

    /** 다듬은 주소로 7자리 번호를 보내고, Redis 에는 번호 원문이 아니라 해시만 남깁니다. */
    @Test
    void sendsSevenDigitCodeAndStoresOnlyItsHash() throws Exception {
        send("  Sailor@Example.com ")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.expiresInSeconds").value(300))
                .andExpect(jsonPath("$.resendAvailableInSeconds").value(60));

        assertThat(mailSender.sentTo(EMAIL)).singleElement()
                .satisfies(mail -> assertThat(mail.code()).matches("^\\d{7}$"));

        String code = mailSender.lastCodeFor(EMAIL);
        Object storedHash = redisTemplate.opsForHash()
                .get("auth:email-verification:" + EMAIL, "hash");
        assertThat(storedHash).isNotNull();
        assertThat(storedHash.toString()).isNotEqualTo(code).hasSize(64);
        assertThat(redisTemplate.getExpire("auth:email-verification:" + EMAIL)).isPositive();
    }

    /** 인증 메일은 요청 언어로 나갑니다. 헤더가 없으면 한국어입니다. */
    @Test
    void sendsMailInRequestLanguage() throws Exception {
        send(EMAIL).andExpect(status().isOk());
        mockMvc.perform(post(SEND_URL)
                        .header("Accept-Language", "en")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(
                                new EmailVerificationRequest(OTHER_EMAIL))))
                .andExpect(status().isOk());

        assertThat(mailSender.sentTo(EMAIL)).singleElement()
                .satisfies(mail -> assertThat(mail.language()).isEqualTo(Language.KO));
        assertThat(mailSender.sentTo(OTHER_EMAIL)).singleElement()
                .satisfies(mail -> assertThat(mail.language()).isEqualTo(Language.EN));
    }

    @Test
    void rejectsAlreadyRegisteredEmail() throws Exception {
        signupHelper.signup(EMAIL, PASSWORD, NICKNAME);
        mailSender.clear();

        send(EMAIL)
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value(AuthErrorCode.AUTH_EMAIL_ALREADY_EXISTS.code()));
        assertThat(mailSender.sentTo(EMAIL)).isEmpty();
    }

    @Test
    void rejectsResendWithinCooldown() throws Exception {
        send(EMAIL).andExpect(status().isOk());

        send(EMAIL)
                .andExpect(status().isTooManyRequests())
                .andExpect(jsonPath("$.code")
                        .value(AuthErrorCode.AUTH_EMAIL_VERIFICATION_RESEND_TOO_SOON.code()));
        assertThat(mailSender.sentTo(EMAIL)).hasSize(1);
    }

    /** 대기 시간을 기다린 것처럼 대기 키만 지워 가며 보내면 여섯 번째에서 막힙니다. */
    @Test
    void rejectsMoreThanFiveSendsPerHour() throws Exception {
        for (int index = 0; index < 5; index++) {
            send(EMAIL).andExpect(status().isOk());
            skipCooldown(EMAIL);
        }

        send(EMAIL)
                .andExpect(status().isTooManyRequests())
                .andExpect(jsonPath("$.code")
                        .value(AuthErrorCode.AUTH_EMAIL_VERIFICATION_SEND_LIMIT_EXCEEDED.code()));
        assertThat(mailSender.sentTo(EMAIL)).hasSize(5);
    }

    @Test
    void rejectsWrongCode() throws Exception {
        send(EMAIL).andExpect(status().isOk());

        confirm(EMAIL, wrongCode(mailSender.lastCodeFor(EMAIL)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code")
                        .value(AuthErrorCode.AUTH_EMAIL_VERIFICATION_CODE_MISMATCH.code()));
    }

    /** 다섯 번째로 틀리면 429 이고 번호가 사라져, 그 뒤엔 맞는 번호도 받지 않습니다. */
    @Test
    void discardsCodeAfterFiveWrongAttempts() throws Exception {
        send(EMAIL).andExpect(status().isOk());
        String code = mailSender.lastCodeFor(EMAIL);

        for (int index = 0; index < 4; index++) {
            confirm(EMAIL, wrongCode(code))
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.code")
                            .value(AuthErrorCode.AUTH_EMAIL_VERIFICATION_CODE_MISMATCH.code()));
        }
        confirm(EMAIL, wrongCode(code))
                .andExpect(status().isTooManyRequests())
                .andExpect(jsonPath("$.code")
                        .value(AuthErrorCode.AUTH_EMAIL_VERIFICATION_TOO_MANY_ATTEMPTS.code()));

        confirm(EMAIL, code)
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code")
                        .value(AuthErrorCode.AUTH_EMAIL_VERIFICATION_EXPIRED.code()));
    }

    /** 다시 받으면 이전 번호는 쓸 수 없고 틀린 횟수도 처음부터 셉니다. */
    @Test
    void resendReplacesCodeAndResetsAttempts() throws Exception {
        send(EMAIL).andExpect(status().isOk());
        String first = mailSender.lastCodeFor(EMAIL);
        for (int index = 0; index < 4; index++) {
            confirm(EMAIL, wrongCode(first)).andExpect(status().isBadRequest());
        }

        skipCooldown(EMAIL);
        send(EMAIL).andExpect(status().isOk());
        String second = mailSender.lastCodeFor(EMAIL);

        if (!first.equals(second)) {
            confirm(EMAIL, first)
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.code")
                            .value(AuthErrorCode.AUTH_EMAIL_VERIFICATION_CODE_MISMATCH.code()));
        }
        confirm(EMAIL, wrongCode(second))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code")
                        .value(AuthErrorCode.AUTH_EMAIL_VERIFICATION_CODE_MISMATCH.code()));
        confirm(EMAIL, second).andExpect(status().isOk());
    }

    @Test
    void rejectsConfirmWithoutSentCode() throws Exception {
        confirm(EMAIL, "0123456")
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code")
                        .value(AuthErrorCode.AUTH_EMAIL_VERIFICATION_EXPIRED.code()));
    }

    /** TTL 이 지난 것과 같게 번호 키를 지우고 확인합니다. */
    @Test
    void rejectsExpiredCode() throws Exception {
        send(EMAIL).andExpect(status().isOk());
        String code = mailSender.lastCodeFor(EMAIL);
        redisTemplate.delete("auth:email-verification:" + EMAIL);

        confirm(EMAIL, code)
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code")
                        .value(AuthErrorCode.AUTH_EMAIL_VERIFICATION_EXPIRED.code()));
    }

    @Test
    void rejectsMalformedCode() throws Exception {
        send(EMAIL).andExpect(status().isOk());

        confirm(EMAIL, "123456").andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("BAD_REQUEST"));
        confirm(EMAIL, "12345678").andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("BAD_REQUEST"));
        confirm(EMAIL, "12a4567").andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("BAD_REQUEST"));
    }

    @Test
    void rejectsInvalidEmailOnSend() throws Exception {
        send("not-an-email")
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("BAD_REQUEST"));
    }

    /** 확인한 번호는 한 번만 쓰고, 받은 토큰으로 가입합니다. */
    @Test
    void confirmedTokenAllowsSignupAndCodeCannotBeReused(CapturedOutput output) throws Exception {
        send(EMAIL).andExpect(status().isOk());
        String code = mailSender.lastCodeFor(EMAIL);

        String token = objectMapper.readTree(confirm(EMAIL, code)
                        .andExpect(status().isOk())
                        .andExpect(jsonPath("$.verificationToken").isNotEmpty())
                        .andExpect(jsonPath("$.expiresInSeconds").value(1800))
                        .andReturn().getResponse().getContentAsString())
                .get("verificationToken").asText();

        confirm(EMAIL, code)
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code")
                        .value(AuthErrorCode.AUTH_EMAIL_VERIFICATION_EXPIRED.code()));

        signupHelper.performSignup(EMAIL, PASSWORD, NICKNAME, token)
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.email").value(EMAIL));
        assertThat(userRepository.findByEmail(EMAIL)).isPresent();
        assertThat(output).doesNotContain(code).doesNotContain(token);
    }

    @Test
    void rejectsSignupWithoutToken() throws Exception {
        mockMvc.perform(post("/api/v1/auth/signup")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"email":"%s","password":"%s","nickname":"%s"}
                                """.formatted(EMAIL, PASSWORD, NICKNAME)))
                .andExpect(status().isBadRequest());

        signupHelper.performSignup(EMAIL, PASSWORD, NICKNAME, "not-a-real-token")
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value(AuthErrorCode.AUTH_EMAIL_NOT_VERIFIED.code()));
        assertThat(userRepository.findByEmail(EMAIL)).isEmpty();
    }

    /** 다른 주소로 받은 토큰으로는 가입하지 못합니다. 그러면 남의 주소로 가입할 수 있습니다. */
    @Test
    void rejectsSignupWithTokenForAnotherEmail() throws Exception {
        String otherToken = signupHelper.verifyEmail(OTHER_EMAIL);

        signupHelper.performSignup(EMAIL, PASSWORD, NICKNAME, otherToken)
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value(AuthErrorCode.AUTH_EMAIL_NOT_VERIFIED.code()));
        assertThat(userRepository.findByEmail(EMAIL)).isEmpty();
    }

    @Test
    void rejectsExpiredToken() throws Exception {
        String token = signupHelper.verifyEmail(EMAIL);
        redisTemplate.delete("auth:email-verified:" + token);

        signupHelper.performSignup(EMAIL, PASSWORD, NICKNAME, token)
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value(AuthErrorCode.AUTH_EMAIL_NOT_VERIFIED.code()));
    }

    /** 가입에 성공하면 토큰이 사라져, 가입한 회원을 지운 뒤에도 같은 토큰으로 다시 가입하지 못합니다. */
    @Test
    void tokenCannotBeReusedAfterSuccessfulSignup() throws Exception {
        String token = signupHelper.verifyEmail(EMAIL);
        signupHelper.performSignup(EMAIL, PASSWORD, NICKNAME, token)
                .andExpect(status().isCreated());

        assertThat(redisTemplate.hasKey("auth:email-verified:" + token)).isFalse();

        userRepository.deleteAll();
        signupHelper.performSignup(EMAIL, PASSWORD, NICKNAME, token)
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value(AuthErrorCode.AUTH_EMAIL_NOT_VERIFIED.code()));
    }

    /** 닉네임 중복으로 가입이 실패하면 토큰이 남아, 닉네임만 바꿔 다시 가입할 수 있습니다. */
    @Test
    void keepsTokenWhenSignupFails() throws Exception {
        signupHelper.signup(OTHER_EMAIL, PASSWORD, NICKNAME);
        String token = signupHelper.verifyEmail(EMAIL);

        signupHelper.performSignup(EMAIL, PASSWORD, NICKNAME, token)
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code")
                        .value(AuthErrorCode.AUTH_NICKNAME_ALREADY_EXISTS.code()));

        signupHelper.performSignup(EMAIL, PASSWORD, "새선원", token)
                .andExpect(status().isCreated());
    }

    /** 메일 서버가 실패하면 503 이고, 대기·횟수·번호가 남지 않아 곧바로 다시 받을 수 있습니다. */
    @Test
    void mailFailureLeavesNoCooldownOrCode(CapturedOutput output) throws Exception {
        mailSender.failNextSend();

        send(EMAIL)
                .andExpect(status().isServiceUnavailable())
                .andExpect(jsonPath("$.code").value(AuthErrorCode.AUTH_EMAIL_SEND_FAILED.code()));
        assertThat(output)
                .contains("Email verification mail failed: exceptionType=MailSendException")
                .doesNotContain(EMAIL);

        assertThat(redisTemplate.hasKey("auth:email-verification-cooldown:" + EMAIL)).isFalse();
        assertThat(redisTemplate.hasKey("auth:email-verification:" + EMAIL)).isFalse();
        assertThat(redisTemplate.opsForValue().get("auth:email-verification-sends:" + EMAIL))
                .isIn(null, "0");
        confirm(EMAIL, "0123456")
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code")
                        .value(AuthErrorCode.AUTH_EMAIL_VERIFICATION_EXPIRED.code()));

        send(EMAIL).andExpect(status().isOk());
        confirm(EMAIL, mailSender.lastCodeFor(EMAIL)).andExpect(status().isOk());
    }

    private ResultActions send(String email) throws Exception {
        return mockMvc.perform(post(SEND_URL)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(new EmailVerificationRequest(email))));
    }

    private ResultActions confirm(String email, String code) throws Exception {
        return mockMvc.perform(post(CONFIRM_URL)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(
                        new EmailVerificationConfirmRequest(email, code))));
    }

    private void skipCooldown(String email) {
        redisTemplate.delete("auth:email-verification-cooldown:" + email);
    }

    /** 맞는 번호의 마지막 자리만 바꿔, 형식은 맞고 값만 틀린 번호를 만듭니다. */
    private String wrongCode(String code) {
        char last = code.charAt(code.length() - 1);
        char changed = last == '9' ? '0' : (char) (last + 1);
        return code.substring(0, code.length() - 1) + changed;
    }
}
