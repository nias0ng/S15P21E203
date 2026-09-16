package com.hyanghae.backend.taste;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.hyanghae.backend.global.security.CurrentUser;
import com.hyanghae.backend.support.IntegrationTest;
import java.util.Optional;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Primary;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;

/**
 * 취향 테스트 저장과 조회를 실제 PostgreSQL 위에서 검증합니다.
 *
 * <p>확인하려는 것이 표의 제약과 다른 도메인에 미치는 결과라 통합 테스트로 둡니다. 한 번만
 * 치른다는 약속은 {@code uk_user_taste_tests_user} 가 지키고, 결과 향수가 지도 안이라는 약속은
 * {@code fk_user_taste_tests_matched_perfume} 가 지킵니다. 배가 결과 향수 자리에 뜨는 것은
 * {@code map_exploration_states} 를 봐야 알 수 있습니다.
 *
 * <p>고정 데이터는 이렇습니다.
 *
 * <ul>
 *   <li>향수 1·2: 지도에 점이 있습니다. 결과가 될 수 있습니다.
 *   <li>향수 3: 좌표가 없습니다. 지도 밖이라 결과가 될 수 없습니다.
 * </ul>
 *
 * <p>계열은 마이그레이션이 심은 9개를 그대로 씁니다. 프론트의 {@code SCENT_FAMILY_KEYS} 와 같은
 * 코드여야 하므로 테스트용으로 새로 만들지 않습니다.
 */
@IntegrationTest
@AutoConfigureMockMvc
class TasteTestIntegrationTest {

    private static final String URL = "/api/v1/users/me/taste-test";
    private static final String SHIP_URL = "/api/v1/map/exploration/me";

    private static final long USER_ID = 1;
    private static final long OTHER_USER_ID = 2;

    /** 지도에 점이 있는 향수입니다. */
    private static final long ON_MAP = 1;
    private static final long ON_MAP_2 = 2;

    /** 좌표가 없어 지도 밖인 향수입니다. */
    private static final long OFF_MAP = 3;

    private static final double ON_MAP_X = 0.09163;
    private static final double ON_MAP_Y = 0.04484;

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Autowired
    private FakeUser currentUser;

    @BeforeEach
    void insertFixtures() {
        clearData();
        currentUser.id = USER_ID;

        jdbcTemplate.update(
                "INSERT INTO users (user_id, email, password_hash, nickname) VALUES (?, ?, 'x', ?)",
                USER_ID, "sailor@hyanghae.com", "항해자");
        jdbcTemplate.update(
                "INSERT INTO users (user_id, email, password_hash, nickname) VALUES (?, ?, 'x', ?)",
                OTHER_USER_ID, "other@hyanghae.com", "다른사람");

        jdbcTemplate.update(
                "INSERT INTO brands (brand_id, name, is_active) VALUES (1, 'Chanel', TRUE)");

        insertPerfume(ON_MAP, "On Map Scent");
        insertPerfume(ON_MAP_2, "Another On Map Scent");
        insertPerfume(OFF_MAP, "Off Map Scent");

        insertMapPoint(ON_MAP, ON_MAP_X, ON_MAP_Y);
        insertMapPoint(ON_MAP_2, 0.5, 0.5);
        // 향수 3 은 좌표를 넣지 않습니다.
    }

    @AfterEach
    void cleanUp() {
        clearData();
    }

    /**
     * 고른 계열이 순위 그대로 돌아옵니다.
     *
     * <p>순서가 뒤집히면 화면이 1순위에 주는 0.58 이 엉뚱한 계열에 붙어 다른 향수가 뽑힙니다.
     * 표가 {@code pick_order} 로 들고 있고 조회가 그 순서로 읽는지 확인합니다.
     */
    @Test
    void keepsPickOrder() throws Exception {
        complete("[\"WOODY\", \"FLORAL\"]", ON_MAP)
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.completed").value(true))
                .andExpect(jsonPath("$.picks[0]").value("WOODY"))
                .andExpect(jsonPath("$.picks[1]").value("FLORAL"))
                .andExpect(jsonPath("$.matchedPerfumeId").value((int) ON_MAP));

        mockMvc.perform(get(URL))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.picks[0]").value("WOODY"))
                .andExpect(jsonPath("$.picks[1]").value("FLORAL"));
    }

    /**
     * <b>배가 결과 향수 자리에 뜹니다.</b> 이것이 취향 테스트를 치르는 목적입니다.
     *
     * <p>치르기 전에는 배 자리가 비어 있다가, 치른 뒤 결과 향수의 지도 좌표로 채워집니다. 화면이
     * 지도를 열면 배가 거기 있습니다.
     */
    @Test
    void placesShipAtMatchedPerfume() throws Exception {
        mockMvc.perform(get(SHIP_URL))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.x").doesNotExist())
                .andExpect(jsonPath("$.y").doesNotExist());

        complete("[\"FLORAL\"]", ON_MAP).andExpect(status().isCreated());

        mockMvc.perform(get(SHIP_URL))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.x").value(ON_MAP_X))
                .andExpect(jsonPath("$.y").value(ON_MAP_Y));
    }

    /**
     * 출발점이 항해 일지의 첫 줄로 남습니다.
     *
     * <p>남기지 않으면 지도를 처음 연 회원의 일지가 비어 있는데 배는 어딘가에 떠 있습니다. 어떻게
     * 거기 갔는지 일지가 말해 주지 않는 상태가 됩니다.
     *
     * <p>기록 한 줄이고 그 향수를 가리킵니다. 배를 놓은 자리와 일지에 적힌 자리가 같아야 하므로
     * 좌표까지 봅니다.
     */
    @Test
    void writesTheStartingPointToTheVoyageLog() throws Exception {
        complete("[\"FLORAL\"]", ON_MAP).andExpect(status().isCreated());

        Integer logs = jdbcTemplate.queryForObject(
                "SELECT count(*) FROM map_exploration_logs WHERE user_id = ?",
                Integer.class, USER_ID);
        assertThat(logs).isOne();

        Long loggedPerfume = jdbcTemplate.queryForObject(
                "SELECT perfume_id FROM map_exploration_logs WHERE user_id = ?",
                Long.class, USER_ID);
        assertThat(loggedPerfume).isEqualTo(ON_MAP);

        Double loggedX = jdbcTemplate.queryForObject(
                "SELECT x_coordinate FROM map_exploration_logs WHERE user_id = ?",
                Double.class, USER_ID);
        assertThat(loggedX).isEqualTo(ON_MAP_X);
    }

    /**
     * 결과 향수를 거절하면 일지도 남지 않습니다.
     *
     * <p>일지는 남고 응시는 없는 상태가 되면, 가 본 적 없는 구역이 항해의 시작으로 적힙니다.
     */
    @Test
    void writesNoVoyageLogWhenThePerfumeIsRejected() throws Exception {
        complete("[\"FLORAL\"]", OFF_MAP).andExpect(status().isBadRequest());

        Integer logs = jdbcTemplate.queryForObject(
                "SELECT count(*) FROM map_exploration_logs WHERE user_id = ?",
                Integer.class, USER_ID);
        assertThat(logs).isZero();
    }

    /**
     * 두 번째 응시는 409 이고 <b>첫 기록도 배 자리도 그대로입니다.</b>
     *
     * <p>한 번만 치른다는 약속입니다. 되돌아가지 않으면 다시 친 회원의 배가 두 번째 결과 향수로
     * 옮겨져, 거절해 놓고 결과는 바꾸는 셈이 됩니다.
     */
    @Test
    void rejectsSecondAttemptAndKeepsFirst() throws Exception {
        complete("[\"FLORAL\"]", ON_MAP).andExpect(status().isCreated());

        complete("[\"WOODY\"]", ON_MAP_2)
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("TASTE_ALREADY_COMPLETED"));

        mockMvc.perform(get(URL))
                .andExpect(jsonPath("$.picks[0]").value("FLORAL"))
                .andExpect(jsonPath("$.matchedPerfumeId").value((int) ON_MAP));

        mockMvc.perform(get(SHIP_URL))
                .andExpect(jsonPath("$.x").value(ON_MAP_X));
    }

    /**
     * 지도에 없는 향수는 400 이고 <b>아무것도 남지 않습니다.</b>
     *
     * <p>좌표가 없으면 배를 놓을 자리가 없습니다. 기록만 남으면 그 회원은 다시 치르지도 못하고
     * 배도 뜨지 않습니다.
     */
    @Test
    void rejectsPerfumeOffTheMap() throws Exception {
        complete("[\"FLORAL\"]", OFF_MAP)
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("TASTE_PERFUME_NOT_ON_MAP"));

        mockMvc.perform(get(URL)).andExpect(jsonPath("$.completed").value(false));

        Integer states = jdbcTemplate.queryForObject(
                "SELECT count(*) FROM map_exploration_states WHERE user_id = ?",
                Integer.class, USER_ID);
        assertThat(states).isZero();
    }

    /**
     * 아예 없는 향수 번호도 400 입니다.
     *
     * <p>지도에 없는 향수와 같은 답입니다. 화면이 받은 후보 밖의 값을 보낸 것이라, 없는
     * 향수인지 지도 밖 향수인지 구분해 줄 이유가 없습니다.
     */
    @Test
    void rejectsPerfumeThatDoesNotExist() throws Exception {
        complete("[\"FLORAL\"]", 999_999)
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("TASTE_PERFUME_NOT_ON_MAP"));

        mockMvc.perform(get(URL)).andExpect(jsonPath("$.completed").value(false));
    }

    /**
     * 내려간 향수는 지도에 점이 남아 있어도 400 입니다.
     *
     * <p>운영에서 내린 향수를 배의 첫 자리로 삼으면, 화면이 그 향수를 보여줄 수 없는데 배는 거기
     * 떠 있게 됩니다. 좌표만 보고 통과시키지 않도록 조회가 {@code is_active} 를 함께 봅니다.
     */
    @Test
    void rejectsInactivePerfumeEvenWhenItHasAPoint() throws Exception {
        jdbcTemplate.update("UPDATE perfumes SET is_active = FALSE WHERE perfume_id = ?", ON_MAP);

        complete("[\"FLORAL\"]", ON_MAP)
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("TASTE_PERFUME_NOT_ON_MAP"));

        Integer states = jdbcTemplate.queryForObject(
                "SELECT count(*) FROM map_exploration_states WHERE user_id = ?",
                Integer.class, USER_ID);
        assertThat(states).isZero();
    }

    /** 고른 계열이 1~2개가 아니면 400 입니다. 0개는 유사도를 잴 수 없고 3개는 화면에 없습니다. */
    @Test
    void rejectsWrongPickCount() throws Exception {
        complete("[]", ON_MAP)
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("TASTE_PICKS_REQUIRED"));

        complete("[\"FLORAL\", \"WOODY\", \"CITRUS\"]", ON_MAP)
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("TASTE_PICKS_REQUIRED"));
    }

    /** 같은 계열을 1순위와 2순위로 겹쳐 고를 수 없습니다. */
    @Test
    void rejectsDuplicatedPicks() throws Exception {
        complete("[\"FLORAL\", \"FLORAL\"]", ON_MAP)
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("TASTE_PICKS_DUPLICATED"));
    }

    /** 없는 계열 코드는 400 입니다. 화면이 내놓지 않는 값이라 오타이거나 옛 코드입니다. */
    @Test
    void rejectsUnknownScentRegion() throws Exception {
        complete("[\"FLORAL\", \"NOT_A_FAMILY\"]", ON_MAP)
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("TASTE_UNKNOWN_SCENT_REGION"));
    }

    /** 아직 치르지 않은 회원은 404 가 아니라 {@code completed} 가 {@code false} 인 200 입니다. */
    @Test
    void answersNotCompletedInsteadOfNotFound() throws Exception {
        mockMvc.perform(get(URL))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.completed").value(false))
                .andExpect(jsonPath("$.picks.length()").value(0))
                .andExpect(jsonPath("$.matchedPerfumeId").doesNotExist());
    }

    /** 다른 회원의 기록은 보이지 않습니다. 기록이 사용자에게 매달려 있습니다. */
    @Test
    void doesNotLeakAnotherUsersTest() throws Exception {
        complete("[\"FLORAL\"]", ON_MAP).andExpect(status().isCreated());

        currentUser.id = OTHER_USER_ID;
        mockMvc.perform(get(URL)).andExpect(jsonPath("$.completed").value(false));
    }

    /** 비로그인은 401 입니다. 회원만 치르는 테스트입니다. */
    @Test
    void requiresLogin() throws Exception {
        currentUser.id = null;

        complete("[\"FLORAL\"]", ON_MAP)
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("TASTE_LOGIN_REQUIRED"));

        mockMvc.perform(get(URL)).andExpect(status().isUnauthorized());
    }

    /**
     * <b>지도를 다시 적재해도 결과 향수가 그대로입니다.</b>
     *
     * <p>{@code load_scent_map.sql} 은 좌표를 맞춰 고치지 않고 지운 뒤 다시 넣습니다. 같은 향수
     * 200개가 그대로 돌아오는 평범한 재적재인데, 결과 향수를
     * {@code perfume_map_points} 에 매달아 두면 그 사이에 전원의 배 출발점이 비워집니다. 바뀐
     * 것이 없는데 사라지는 것이라 알아차리기도 어렵습니다.
     *
     * <p>그래서 결과 향수는 {@code perfumes} 를 가리킵니다. 지도에 있다는 것은 저장하는 순간의
     * 조건이고, 그 확인은 서비스가 합니다.
     */
    @Test
    void keepsMatchedPerfumeWhenTheMapIsReloaded() throws Exception {
        complete("[\"FLORAL\", \"WOODY\"]", ON_MAP).andExpect(status().isCreated());

        // 적재 스크립트 6번이 하는 그대로입니다.
        jdbcTemplate.update("DELETE FROM perfume_map_points");
        insertMapPoint(ON_MAP, ON_MAP_X, ON_MAP_Y);
        insertMapPoint(ON_MAP_2, 0.5, 0.5);

        mockMvc.perform(get(URL))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.completed").value(true))
                .andExpect(jsonPath("$.matchedPerfumeId").value((int) ON_MAP))
                .andExpect(jsonPath("$.x").value(ON_MAP_X));
    }

    /**
     * 향수가 정말로 지워지면 결과 향수만 비고 응시 기록은 남습니다.
     *
     * <p>기록까지 지워지면 그 회원은 한 번만 치른다는 약속과 달리 다시 쳐야 합니다. 고른 계열은
     * 남아 있어 자리를 다시 구할 수 있습니다.
     *
     * <p>앞의 재적재와 나눠 둔 이유가 있습니다. 좌표가 사라지는 것과 향수가 사라지는 것은 다른
     * 일인데, 결과 향수를 좌표에 매달면 둘이 같은 일이 됩니다.
     */
    @Test
    void keepsTestWhenPerfumeItselfIsDeleted() throws Exception {
        complete("[\"FLORAL\", \"WOODY\"]", ON_MAP).andExpect(status().isCreated());

        jdbcTemplate.update("DELETE FROM perfume_map_points WHERE perfume_id = ?", ON_MAP);
        jdbcTemplate.update("DELETE FROM perfumes WHERE perfume_id = ?", ON_MAP);

        mockMvc.perform(get(URL))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.completed").value(true))
                .andExpect(jsonPath("$.picks[0]").value("FLORAL"))
                .andExpect(jsonPath("$.matchedPerfumeId").doesNotExist())
                .andExpect(jsonPath("$.x").doesNotExist());
    }

    private ResultActions complete(String picksJson, long perfumeId) throws Exception {
        String body = "{\"picks\": %s, \"matchedPerfumeId\": %d}".formatted(picksJson, perfumeId);
        return mockMvc.perform(post(URL)
                .contentType(MediaType.APPLICATION_JSON)
                .content(body));
    }

    private void insertPerfume(long perfumeId, String name) {
        jdbcTemplate.update(
                "INSERT INTO perfumes (perfume_id, name, brand_id, is_active) VALUES (?, ?, 1, TRUE)",
                perfumeId, name);
    }

    private void insertMapPoint(long perfumeId, double x, double y) {
        jdbcTemplate.update(
                "INSERT INTO perfume_map_points (perfume_id, map_x, map_y) VALUES (?, ?, ?)",
                perfumeId, x, y);
    }

    private void clearData() {
        jdbcTemplate.update("DELETE FROM user_taste_test_selections");
        jdbcTemplate.update("DELETE FROM user_taste_tests");
        jdbcTemplate.update("DELETE FROM map_exploration_states");
        jdbcTemplate.update("DELETE FROM map_exploration_logs");
        jdbcTemplate.update("DELETE FROM perfume_map_points");
        jdbcTemplate.update("DELETE FROM perfumes");
        jdbcTemplate.update("DELETE FROM brands");
        jdbcTemplate.update("DELETE FROM users");
    }

    @TestConfiguration
    static class Config {

        @Bean
        @Primary
        FakeUser fakeUser() {
            return new FakeUser();
        }
    }

    /** 인증이 아직 없어 원하는 사용자 번호를 돌려주는 가짜를 넣습니다. */
    static class FakeUser implements CurrentUser {

        Long id;

        @Override
        public Optional<Long> id() {
            return Optional.ofNullable(id);
        }
    }
}
