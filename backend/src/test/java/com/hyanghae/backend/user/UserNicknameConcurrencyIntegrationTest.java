package com.hyanghae.backend.user;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.hyanghae.backend.auth.dto.request.LoginRequest;
import com.hyanghae.backend.support.FakeEmailVerificationMailSender;
import com.hyanghae.backend.support.IntegrationTest;
import com.hyanghae.backend.support.SignupTestHelper;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.Callable;
import java.util.concurrent.CyclicBarrier;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.data.redis.core.RedisCallback;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

/**
 * 서로 다른 회원이 같은 닉네임으로 동시에 바꾸려 할 때 하나만 통과하는지 검증합니다.
 *
 * <p>한 번에 하나씩 올 때는 드러나지 않는 자리입니다. 중복 검사와 저장 사이에 틈이 있어, 두
 * 요청이 모두 "안 쓰고 있다" 를 보고 지나갑니다. 막는 것은 {@code uk_users_nickname} 이고
 * 서비스는 거기서 나온 실패를 같은 409 로 바꿉니다.
 *
 * <p>요청이 같은 순간에 출발하도록 관문으로 맞춥니다. 어느 쪽이 먼저 도착하는지는 그때그때
 * 다르지만 결과는 매번 같아야 합니다. 그래서 타이밍에 기대지 않습니다.
 *
 * <p>회원마다 토큰이 다릅니다. 여러 사람이 <b>서로 다른 계정으로</b> 같은 이름을 노리는
 * 상황이라, 한 사람이 여러 번 보내는 경우와 다릅니다.
 */
@IntegrationTest
@AutoConfigureMockMvc
@TestPropertySource(properties = "hyanghae.auth.enforce-http-authorization=true")
class UserNicknameConcurrencyIntegrationTest {

    private static final String NICKNAME_URL = "/api/v1/users/me/nickname";
    private static final String PASSWORD = "password123";

    /** 노리는 닉네임입니다. 아무도 쓰고 있지 않은 상태에서 시작합니다. */
    private static final String TARGET = "바다지기";

    /** 동시에 달릴 요청 수입니다. 커넥션 풀(기본 10)보다 작게 잡습니다. */
    private static final int CONCURRENT = 4;

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Autowired
    private StringRedisTemplate redisTemplate;

    @Autowired
    private FakeEmailVerificationMailSender mailSender;

    private final List<String> tokens = new ArrayList<>();

    @BeforeEach
    void setUp() throws Exception {
        jdbcTemplate.update("DELETE FROM users");
        redisTemplate.execute((RedisCallback<Void>) connection -> {
            connection.serverCommands().flushDb();
            return null;
        });

        tokens.clear();
        for (int index = 0; index < CONCURRENT; index++) {
            tokens.add(signupAndLogin("sailor" + index + "@example.com", "항해자" + index));
        }
    }

    /**
     * 네 요청이 같은 순간에 들어와도 <b>하나만 200 이고 나머지는 모두 409</b> 입니다.
     *
     * <p>그 닉네임을 가진 회원도 정확히 한 명이어야 합니다. 상태 코드만 보면 진 요청이 값을
     * 덮어썼는지 알 수 없습니다.
     */
    @Test
    void letsOnlyOneRequestTakeTheNickname() throws Exception {
        List<Integer> statuses = runTogether(CONCURRENT, this::changeStatus);

        assertThat(statuses).filteredOn(status -> status == 200).hasSize(1);
        assertThat(statuses).filteredOn(status -> status == 409).hasSize(CONCURRENT - 1);

        Integer taken = jdbcTemplate.queryForObject(
                "SELECT count(*) FROM users WHERE nickname = ?", Integer.class, TARGET);
        assertThat(taken).isOne();
    }

    /** 요청 {@code count} 개를 같은 순간에 출발시키고 상태 코드를 모읍니다. */
    private List<Integer> runTogether(int count, ThrowingIntFunction task) throws Exception {
        CyclicBarrier gate = new CyclicBarrier(count);
        ExecutorService pool = Executors.newFixedThreadPool(count);

        try {
            List<Callable<Integer>> calls = new ArrayList<>();
            for (int index = 0; index < count; index++) {
                int current = index;
                calls.add(() -> {
                    gate.await();
                    return task.apply(current);
                });
            }

            List<Integer> statuses = new ArrayList<>();
            for (Future<Integer> future : pool.invokeAll(calls)) {
                statuses.add(future.get());
            }
            return statuses;
        } finally {
            pool.shutdownNow();
        }
    }

    private int changeStatus(int index) throws Exception {
        return mockMvc.perform(patch(NICKNAME_URL)
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + tokens.get(index))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"nickname\":\"" + TARGET + "\"}"))
                .andReturn()
                .getResponse()
                .getStatus();
    }

    private String signupAndLogin(String email, String nickname) throws Exception {
        new SignupTestHelper(mockMvc, objectMapper, mailSender).signup(email, PASSWORD, nickname);

        MvcResult result = mockMvc.perform(post("/api/v1/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(
                                new LoginRequest(email, PASSWORD))))
                .andExpect(status().isOk())
                .andReturn();
        JsonNode response = objectMapper.readTree(result.getResponse().getContentAsString());
        return response.get("accessToken").asText();
    }

    @FunctionalInterface
    interface ThrowingIntFunction {

        int apply(int index) throws Exception;
    }
}
