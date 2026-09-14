package com.hyanghae.backend.shelf;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.hyanghae.backend.global.security.CurrentUser;
import com.hyanghae.backend.shelf.exception.ShelfErrorCode;
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

@IntegrationTest
@AutoConfigureMockMvc
class OwnershipStatusIntegrationTest {

    private static final long LOGGED_IN_USER = 1L;
    private static final long OTHER_USER = 2L;
    private static final long REPRESENTATIVE_SHELF_ITEM = 155L;
    private static final long NORMAL_SHELF_ITEM = 156L;
    private static final long OTHER_USER_SHELF_ITEM = 157L;

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

        insertUser(LOGGED_IN_USER, "me-ownership@example.com", "me-ownership");
        insertUser(OTHER_USER, "other-ownership@example.com", "other-ownership");
        insertPerfume(1L, "Representative Scent");
        insertPerfume(2L, "Normal Scent");
        insertPerfume(3L, "Other User Scent");

        insertShelfItem(REPRESENTATIVE_SHELF_ITEM, LOGGED_IN_USER, 1L, "OWNED", true);
        insertShelfItem(NORMAL_SHELF_ITEM, LOGGED_IN_USER, 2L, "TRIED", false);
        insertShelfItem(OTHER_USER_SHELF_ITEM, OTHER_USER, 3L, "OWNED", false);
    }

    @AfterEach
    void cleanUp() {
        clearData();
        fakeCurrentUser.logout();
    }

    @Test
    void updatesOwnershipStatus() throws Exception {
        fakeCurrentUser.login(LOGGED_IN_USER);

        mockMvc.perform(patch(url(NORMAL_SHELF_ITEM))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"ownershipStatus\":\"WISH\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.shelfItemId").value(NORMAL_SHELF_ITEM))
                .andExpect(jsonPath("$.ownershipStatus").value("WISH"))
                .andExpect(jsonPath("$.updatedAt").isNotEmpty());

        assertThat(findOwnershipStatus(NORMAL_SHELF_ITEM)).isEqualTo("WISH");
    }

    @Test
    void clearsRepresentativeWhenChangingAwayFromOwned() throws Exception {
        fakeCurrentUser.login(LOGGED_IN_USER);

        mockMvc.perform(patch(url(REPRESENTATIVE_SHELF_ITEM))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"ownershipStatus\":\"TRIED\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.ownershipStatus").value("TRIED"));

        assertThat(findOwnershipStatus(REPRESENTATIVE_SHELF_ITEM)).isEqualTo("TRIED");
        assertThat(isRepresentative(REPRESENTATIVE_SHELF_ITEM)).isFalse();
    }

    @Test
    void doesNotAssignRepresentativeWhenChangingToOwned() throws Exception {
        fakeCurrentUser.login(LOGGED_IN_USER);

        mockMvc.perform(patch(url(NORMAL_SHELF_ITEM))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"ownershipStatus\":\"OWNED\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.ownershipStatus").value("OWNED"));

        assertThat(isRepresentative(NORMAL_SHELF_ITEM)).isFalse();
    }

    @Test
    void rejectsUnknownOwnershipStatus() throws Exception {
        fakeCurrentUser.login(LOGGED_IN_USER);

        mockMvc.perform(patch(url(NORMAL_SHELF_ITEM))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"ownershipStatus\":\"BORROWED\"}"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void rejectsMissingOwnershipStatus() throws Exception {
        fakeCurrentUser.login(LOGGED_IN_USER);

        mockMvc.perform(patch(url(NORMAL_SHELF_ITEM))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{}"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void requiresLogin() throws Exception {
        mockMvc.perform(patch(url(NORMAL_SHELF_ITEM))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"ownershipStatus\":\"WISH\"}"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value(ShelfErrorCode.SHELF_LOGIN_REQUIRED.code()));
    }

    @Test
    void hidesOtherUsersShelfItem() throws Exception {
        fakeCurrentUser.login(LOGGED_IN_USER);

        mockMvc.perform(patch(url(OTHER_USER_SHELF_ITEM))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"ownershipStatus\":\"WISH\"}"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value(ShelfErrorCode.SHELF_ITEM_NOT_FOUND.code()));

        assertThat(findOwnershipStatus(OTHER_USER_SHELF_ITEM)).isEqualTo("OWNED");
    }

    private String url(long shelfItemId) {
        return "/api/v1/users/me/shelf-items/" + shelfItemId + "/ownership";
    }

    private void insertUser(long id, String email, String nickname) {
        jdbcTemplate.update(
                "INSERT INTO users (user_id, email, password_hash, nickname) VALUES (?, ?, 'x', ?)",
                id, email, nickname
        );
    }

    private void insertPerfume(long id, String name) {
        jdbcTemplate.update(
                "INSERT INTO perfumes (perfume_id, name, is_active) VALUES (?, ?, true)",
                id, name
        );
    }

    private void insertShelfItem(
            long id,
            long userId,
            long perfumeId,
            String ownershipStatus,
            boolean representative
    ) {
        jdbcTemplate.update(
                "INSERT INTO user_perfumes "
                        + "(user_perfumes_id, user_id, perfume_id, ownership_status, is_representative) "
                        + "VALUES (?, ?, ?, ?, ?)",
                id, userId, perfumeId, ownershipStatus, representative
        );
    }

    private String findOwnershipStatus(long shelfItemId) {
        return jdbcTemplate.queryForObject(
                "SELECT ownership_status FROM user_perfumes WHERE user_perfumes_id = ?",
                String.class,
                shelfItemId
        );
    }

    private Boolean isRepresentative(long shelfItemId) {
        return jdbcTemplate.queryForObject(
                "SELECT is_representative FROM user_perfumes WHERE user_perfumes_id = ?",
                Boolean.class,
                shelfItemId
        );
    }

    private void clearData() {
        jdbcTemplate.update("DELETE FROM memos");
        jdbcTemplate.update("DELETE FROM user_perfumes");
        jdbcTemplate.update("DELETE FROM perfumes");
        jdbcTemplate.update("DELETE FROM users");
    }

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
