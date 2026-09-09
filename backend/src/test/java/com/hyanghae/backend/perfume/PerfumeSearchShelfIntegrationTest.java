package com.hyanghae.backend.perfume;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.hyanghae.backend.global.security.CurrentUser;
import com.hyanghae.backend.perfume.exception.PerfumeErrorCode;
import com.hyanghae.backend.support.IntegrationTest;
import java.util.Optional;
import org.hamcrest.Matchers;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Primary;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;

/**
 * 검색의 진열대 필터를 실제 PostgreSQL 위에서 검증합니다.
 *
 * <p>인증이 아직 없어 운영에서는 모든 요청이 비로그인이고 이 필터는 항상 401 입니다. 로그인한
 * 경우의 동작은 {@link CurrentUser} 를 가짜로 갈아끼워 여기서 검증합니다. 인증이 붙으면 구현체만
 * 바뀌고 아래 동작은 그대로여야 합니다.
 *
 * <p>사용자 1 이 로그인한 사용자, 사용자 2 는 타인입니다.
 */
@IntegrationTest
@AutoConfigureMockMvc
class PerfumeSearchShelfIntegrationTest {

    private static final String SEARCH_URL = "/api/v1/perfumes";

    private static final long LOGGED_IN_USER = 1L;
    private static final long OTHER_USER = 2L;
    private static final long USER_WITHOUT_SHELF = 3L;

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Autowired
    private FakeCurrentUser fakeCurrentUser;

    @BeforeEach
    void insertFixtures() {
        clearData();
        fakeCurrentUser.logout();

        insertUser(LOGGED_IN_USER, "me@example.com", "me");
        insertUser(OTHER_USER, "other@example.com", "other");
        insertUser(USER_WITHOUT_SHELF, "empty@example.com", "empty");

        insertBrand(1, "Chanel");
        insertBrand(2, "Diptyque");

        insertPerfume(1, 1, "Owned Scent", true);
        insertPerfume(2, 1, "Wish Scent", true);
        insertPerfume(3, 2, "Viewed Scent", true);
        insertPerfume(4, 1, "Removed From Shelf", true);
        insertPerfume(5, 1, "Other User Scent", true);
        insertPerfume(6, 1, "Inactive Owned Scent", false);
        insertPerfume(7, 2, "Owned Diptyque", true);

        insertShelfEntry(100, LOGGED_IN_USER, 1, "OWNED");
        insertShelfEntry(101, LOGGED_IN_USER, 2, "WISH");
        insertShelfEntry(102, LOGGED_IN_USER, 4, "OWNED");
        // 진열대 해제는 행을 물리 삭제합니다.
        jdbcTemplate.update("DELETE FROM user_perfumes WHERE user_perfumes_id = 102");
        insertShelfEntry(103, OTHER_USER, 5, "OWNED");
        insertShelfEntry(104, LOGGED_IN_USER, 6, "OWNED");
        insertShelfEntry(105, LOGGED_IN_USER, 7, "OWNED");

        // 같은 향수를 두 번 봤습니다. 결과에는 한 번만 나와야 합니다.
        insertView(200, LOGGED_IN_USER, 3);
        insertView(201, LOGGED_IN_USER, 3);
        insertView(202, OTHER_USER, 1);
    }

    @AfterEach
    void cleanUp() {
        clearData();
        fakeCurrentUser.logout();
    }

    /** 비로그인 요청에 조용히 전체를 돌려주면 필터가 걸린 것처럼 보이지만 남의 자료가 섞입니다. */
    @Test
    void returnsUnauthorizedWhenShelfFilterUsedWithoutLogin() throws Exception {
        mockMvc.perform(get(SEARCH_URL).param("shelf", "OWNED"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code")
                        .value(PerfumeErrorCode.PERFUME_SHELF_FILTER_REQUIRES_LOGIN.code()));
    }

    /** 진열대 필터가 없으면 로그인은 필요 없습니다. */
    @Test
    void doesNotRequireLoginWhenShelfFilterAbsent() throws Exception {
        mockMvc.perform(get(SEARCH_URL).param("keyword", "Owned Scent"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.perfumes", Matchers.hasSize(1)));
    }

    /** 보유 중으로 담아 둔 향수만 나옵니다. 뺀 것·타인 것·비활성은 빠집니다. */
    @Test
    void filtersByOwnedShelf() throws Exception {
        fakeCurrentUser.login(LOGGED_IN_USER);

        mockMvc.perform(get(SEARCH_URL).param("shelf", "OWNED"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.perfumes", Matchers.hasSize(2)))
                .andExpect(jsonPath("$.perfumes[0].perfumeId").value(1))
                .andExpect(jsonPath("$.perfumes[1].perfumeId").value(7))
                .andExpect(jsonPath("$.totalElements").value(2));
    }

    @Test
    void filtersByWishShelf() throws Exception {
        fakeCurrentUser.login(LOGGED_IN_USER);

        mockMvc.perform(get(SEARCH_URL).param("shelf", "WISH"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.perfumes", Matchers.hasSize(1)))
                .andExpect(jsonPath("$.perfumes[0].perfumeId").value(2));
    }

    /** 같은 향수를 여러 번 봐도 한 건입니다. */
    @Test
    void filtersByViewedShelfWithoutDuplicates() throws Exception {
        fakeCurrentUser.login(LOGGED_IN_USER);

        mockMvc.perform(get(SEARCH_URL).param("shelf", "VIEWED"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.perfumes", Matchers.hasSize(1)))
                .andExpect(jsonPath("$.perfumes[0].perfumeId").value(3))
                .andExpect(jsonPath("$.totalElements").value(1));
    }

    /** 물리 삭제한 진열대 항목은 검색 결과에 포함되지 않습니다. */
    @Test
    void excludesShelfEntryRemovedFromShelf() throws Exception {
        fakeCurrentUser.login(LOGGED_IN_USER);

        mockMvc.perform(get(SEARCH_URL).param("shelf", "OWNED"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.perfumes[*].perfumeId", Matchers.not(Matchers.hasItem(4))));
    }

    @Test
    void excludesOtherUsersShelf() throws Exception {
        fakeCurrentUser.login(LOGGED_IN_USER);

        mockMvc.perform(get(SEARCH_URL).param("shelf", "OWNED"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.perfumes[*].perfumeId", Matchers.not(Matchers.hasItem(5))));
    }

    /** 진열대에 있어도 비활성 향수는 나오지 않습니다. 다른 조회와 같은 기준입니다. */
    @Test
    void excludesInactivePerfumeFromShelfResult() throws Exception {
        fakeCurrentUser.login(LOGGED_IN_USER);

        mockMvc.perform(get(SEARCH_URL).param("shelf", "OWNED"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.perfumes[*].perfumeId", Matchers.not(Matchers.hasItem(6))));
    }

    @Test
    void combinesShelfWithBrandUsingAnd() throws Exception {
        fakeCurrentUser.login(LOGGED_IN_USER);

        mockMvc.perform(get(SEARCH_URL).param("shelf", "OWNED").param("brand", "Chanel"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.perfumes", Matchers.hasSize(1)))
                .andExpect(jsonPath("$.perfumes[0].perfumeId").value(1));
    }

    /** 진열대가 비어 있으면 IN 절에 넣을 값이 없습니다. SQL 오류가 아니라 빈 목록이어야 합니다. */
    @Test
    void returnsEmptyWhenShelfHasNoPerfume() throws Exception {
        fakeCurrentUser.login(USER_WITHOUT_SHELF);

        mockMvc.perform(get(SEARCH_URL).param("shelf", "OWNED"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.perfumes", Matchers.hasSize(0)))
                .andExpect(jsonPath("$.totalElements").value(0));
    }

    @Test
    void rejectsUnknownShelfValue() throws Exception {
        fakeCurrentUser.login(LOGGED_IN_USER);

        mockMvc.perform(get(SEARCH_URL).param("shelf", "BORROWED"))
                .andExpect(status().isBadRequest());
    }

    private void insertUser(long id, String email, String nickname) {
        jdbcTemplate.update(
                "INSERT INTO users (user_id, email, password_hash, nickname) VALUES (?, ?, 'x', ?)",
                id, email, nickname);
    }

    private void insertBrand(long id, String name) {
        jdbcTemplate.update(
                "INSERT INTO brands (brand_id, name, is_active) VALUES (?, ?, true)", id, name);
    }

    private void insertPerfume(long id, long brandId, String name, boolean active) {
        jdbcTemplate.update(
                "INSERT INTO perfumes (perfume_id, brand_id, name, is_active) VALUES (?, ?, ?, ?)",
                id, brandId, name, active);
    }

    private void insertShelfEntry(long id, long userId, long perfumeId, String ownershipStatus) {
        jdbcTemplate.update(
                "INSERT INTO user_perfumes (user_perfumes_id, user_id, perfume_id, ownership_status)"
                        + " VALUES (?, ?, ?, ?)",
                id, userId, perfumeId, ownershipStatus);
    }

    private void insertView(long id, long userId, long perfumeId) {
        jdbcTemplate.update(
                "INSERT INTO user_perfume_views (perfume_view_id, user_id, perfume_id) VALUES (?, ?, ?)",
                id, userId, perfumeId);
    }

    private void clearData() {
        jdbcTemplate.update("DELETE FROM user_perfume_views");
        jdbcTemplate.update("DELETE FROM user_perfumes");
        jdbcTemplate.update("DELETE FROM perfumes");
        jdbcTemplate.update("DELETE FROM brands");
        jdbcTemplate.update("DELETE FROM users");
    }

    /**
     * 인증이 없는 동안 로그인한 경우를 재현합니다. {@code @Primary} 라 운영 구현인
     * {@code AnonymousCurrentUser} 대신 주입됩니다.
     */
    @TestConfiguration
    static class FakeCurrentUserConfig {

        @Bean
        @Primary
        FakeCurrentUser fakeCurrentUser() {
            return new FakeCurrentUser();
        }
    }

    static class FakeCurrentUser implements CurrentUser {

        private Long id;

        void login(Long id) {
            this.id = id;
        }

        void logout() {
            this.id = null;
        }

        @Override
        public Optional<Long> id() {
            return Optional.ofNullable(id);
        }
    }
}
