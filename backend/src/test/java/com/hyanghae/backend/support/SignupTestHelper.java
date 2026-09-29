package com.hyanghae.backend.support;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.hyanghae.backend.auth.dto.request.EmailVerificationConfirmRequest;
import com.hyanghae.backend.auth.dto.request.EmailVerificationRequest;
import com.hyanghae.backend.auth.dto.request.SignupRequest;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.ResultActions;

/**
 * 가입에 이메일 인증이 필요해져, 가입을 거치는 통합 테스트가 인증번호 전송·확인을 함께 밟게 합니다.
 *
 * <p>실제 API 를 차례로 부릅니다. 토큰을 Redis 에 직접 넣으면 인증 흐름이 깨져도 가입 테스트가
 * 그대로 통과합니다.
 */
public class SignupTestHelper {

    private final MockMvc mockMvc;
    private final ObjectMapper objectMapper;
    private final FakeEmailVerificationMailSender mailSender;

    public SignupTestHelper(
            MockMvc mockMvc,
            ObjectMapper objectMapper,
            FakeEmailVerificationMailSender mailSender
    ) {
        this.mockMvc = mockMvc;
        this.objectMapper = objectMapper;
        this.mailSender = mailSender;
    }

    /** 인증번호를 받아 확인하고 가입에 쓸 토큰을 돌려줍니다. */
    public String verifyEmail(String email) throws Exception {
        mockMvc.perform(post("/api/v1/auth/email-verifications")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(new EmailVerificationRequest(email))))
                .andExpect(status().isOk());

        MvcResult result = mockMvc.perform(post("/api/v1/auth/email-verifications/confirm")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(new EmailVerificationConfirmRequest(
                                email, mailSender.lastCodeFor(email)))))
                .andExpect(status().isOk())
                .andReturn();
        return objectMapper.readTree(result.getResponse().getContentAsString())
                .get("verificationToken")
                .asText();
    }

    public ResultActions performSignup(
            String email,
            String password,
            String nickname,
            String emailVerificationToken
    ) throws Exception {
        return mockMvc.perform(post("/api/v1/auth/signup")
                .contentType(MediaType.APPLICATION_JSON)
                .content(json(new SignupRequest(email, password, nickname, emailVerificationToken))));
    }

    /** 인증부터 가입까지 거칩니다. 가입 응답을 돌려주므로 호출한 쪽이 본문을 더 볼 수 있습니다. */
    public ResultActions signup(String email, String password, String nickname) throws Exception {
        return performSignup(email, password, nickname, verifyEmail(email))
                .andExpect(status().isCreated());
    }

    private String json(Object value) throws Exception {
        return objectMapper.writeValueAsString(value);
    }
}
