package com.hyanghae.backend.shelf;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
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
import org.springframework.test.web.servlet.MvcResult;

@IntegrationTest
@AutoConfigureMockMvc
class ShelfItemSaveIntegrationTest {

    private static final long LOGGED_IN_USER = 1L;
    private static final long OTHER_USER = 2L;
    private static final long ACTIVE_PERFUME = 1L;
    private static final long SECOND_PERFUME = 2L;
    private static final long INACTIVE_PERFUME = 3L;

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private FakeCurrentUser fakeCurrentUser;

    @BeforeEach
    void insertFixtures() {
        clearData();
        fakeCurrentUser.logout();

        insertUser(LOGGED_IN_USER, "me-save@example.com", "me-save");
        insertUser(OTHER_USER, "other-save@example.com", "other-save");
        insertPerfume(ACTIVE_PERFUME, "Active Scent", true);
        insertPerfume(SECOND_PERFUME, "Second Scent", true);
        insertPerfume(INACTIVE_PERFUME, "Inactive Scent", false);
    }

    @AfterEach
    void cleanUp() {
        clearData();
        fakeCurrentUser.logout();
    }

    @Test
    void savesShelfItemWithWishByDefault() throws Exception {
        fakeCurrentUser.login(LOGGED_IN_USER);

        mockMvc.perform(post(baseUrl())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"perfumeId\":1}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.shelfItemId").isNumber())
                .andExpect(jsonPath("$.perfumeId").value(ACTIVE_PERFUME))
                .andExpect(jsonPath("$.ownershipStatus").value("WISH"))
                .andExpect(jsonPath("$.createdAt").isNotEmpty());

        assertThat(findOwnershipStatus(LOGGED_IN_USER, ACTIVE_PERFUME)).isEqualTo("WISH");
    }

    @Test
    void savesRequestedOwnershipStatus() throws Exception {
        fakeCurrentUser.login(LOGGED_IN_USER);

        mockMvc.perform(post(baseUrl())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"perfumeId\":1,\"ownershipStatus\":\"OWNED\"}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.ownershipStatus").value("OWNED"));
    }

    @Test
    void rejectsDuplicateShelfItem() throws Exception {
        fakeCurrentUser.login(LOGGED_IN_USER);
        createShelfItem(ACTIVE_PERFUME);

        mockMvc.perform(post(baseUrl())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"perfumeId\":1}"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code")
                        .value(ShelfErrorCode.SHELF_ITEM_ALREADY_EXISTS.code()));

        assertThat(countShelfItems(LOGGED_IN_USER, ACTIVE_PERFUME)).isOne();
    }

    @Test
    void rejectsInactivePerfume() throws Exception {
        fakeCurrentUser.login(LOGGED_IN_USER);

        mockMvc.perform(post(baseUrl())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"perfumeId\":3}"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value(ShelfErrorCode.SHELF_PERFUME_NOT_FOUND.code()));
    }

    @Test
    void rejectsInvalidRequest() throws Exception {
        fakeCurrentUser.login(LOGGED_IN_USER);

        mockMvc.perform(post(baseUrl())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"perfumeId\":0,\"ownershipStatus\":\"BORROWED\"}"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void requiresLoginToSave() throws Exception {
        mockMvc.perform(post(baseUrl())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"perfumeId\":1}"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value(ShelfErrorCode.SHELF_LOGIN_REQUIRED.code()));
    }

    @Test
    void requiresLoginToDelete() throws Exception {
        fakeCurrentUser.login(LOGGED_IN_USER);
        long shelfItemId = createShelfItem(ACTIVE_PERFUME);
        fakeCurrentUser.logout();

        mockMvc.perform(delete(baseUrl() + "/" + shelfItemId))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value(ShelfErrorCode.SHELF_LOGIN_REQUIRED.code()));

        assertThat(countRows("user_perfumes", "user_perfumes_id", shelfItemId)).isOne();
    }

    @Test
    void physicallyDeletesShelfItemAndDependentData() throws Exception {
        fakeCurrentUser.login(LOGGED_IN_USER);
        long shelfItemId = createShelfItem(ACTIVE_PERFUME);
        long collectionId = insertCollection(LOGGED_IN_USER);
        long otherPerfumeId = jdbcTemplate.queryForObject(
                "INSERT INTO perfumes (perfume_id, name) VALUES (900, 'other collection perfume') RETURNING perfume_id",
                Long.class);
        long otherShelfId = jdbcTemplate.queryForObject(
                "INSERT INTO user_perfumes (user_id, perfume_id) VALUES (?, ?) RETURNING user_perfumes_id",
                Long.class, LOGGED_IN_USER, otherPerfumeId);
        jdbcTemplate.update(
                "INSERT INTO collection_perfumes (collection_id, user_perfume_id) VALUES (?, ?)",
                collectionId, otherShelfId);
        jdbcTemplate.update(
                "INSERT INTO memos (user_perfume_id, content) VALUES (?, 'memo')",
                shelfItemId
        );
        jdbcTemplate.update(
                "INSERT INTO collection_perfumes (collection_id, user_perfume_id) VALUES (?, ?)",
                collectionId,
                shelfItemId
        );

        mockMvc.perform(delete(baseUrl() + "/" + shelfItemId))
                .andExpect(status().isNoContent());

        assertThat(countRows("user_perfumes", "user_perfumes_id", shelfItemId)).isZero();
        assertThat(countRows("memos", "user_perfume_id", shelfItemId)).isZero();
        assertThat(countRows("collection_perfumes", "user_perfume_id", shelfItemId)).isZero();
    }

    @Test
    void hidesOtherUsersShelfItemOnDelete() throws Exception {
        fakeCurrentUser.login(OTHER_USER);
        long shelfItemId = createShelfItem(ACTIVE_PERFUME);
        fakeCurrentUser.login(LOGGED_IN_USER);

        mockMvc.perform(delete(baseUrl() + "/" + shelfItemId))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value(ShelfErrorCode.SHELF_ITEM_NOT_FOUND.code()));

        assertThat(countRows("user_perfumes", "user_perfumes_id", shelfItemId)).isOne();
    }

    @Test
    void canSaveAgainWithNewShelfItemIdAfterDelete() throws Exception {
        fakeCurrentUser.login(LOGGED_IN_USER);
        long deletedShelfItemId = createShelfItem(SECOND_PERFUME);

        mockMvc.perform(delete(baseUrl() + "/" + deletedShelfItemId))
                .andExpect(status().isNoContent());

        long recreatedShelfItemId = createShelfItem(SECOND_PERFUME);

        assertThat(recreatedShelfItemId).isNotEqualTo(deletedShelfItemId);
    }

    private long createShelfItem(long perfumeId) throws Exception {
        MvcResult result = mockMvc.perform(post(baseUrl())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"perfumeId\":" + perfumeId + "}"))
                .andExpect(status().isCreated())
                .andReturn();
        JsonNode response = objectMapper.readTree(result.getResponse().getContentAsString());
        return response.get("shelfItemId").asLong();
    }

    private String baseUrl() {
        return "/api/v1/users/me/shelf-items";
    }

    private void insertUser(long id, String email, String nickname) {
        jdbcTemplate.update(
                "INSERT INTO users (user_id, email, password_hash, nickname) VALUES (?, ?, 'x', ?)",
                id, email, nickname
        );
    }

    private void insertPerfume(long id, String name, boolean active) {
        jdbcTemplate.update(
                "INSERT INTO perfumes (perfume_id, name, is_active) VALUES (?, ?, ?)",
                id, name, active
        );
    }

    private long insertCollection(long userId) {
        return jdbcTemplate.queryForObject(
                "INSERT INTO collections (user_id, name) VALUES (?, 'favorites') RETURNING collection_id",
                Long.class,
                userId
        );
    }

    private String findOwnershipStatus(long userId, long perfumeId) {
        return jdbcTemplate.queryForObject(
                "SELECT ownership_status FROM user_perfumes WHERE user_id = ? AND perfume_id = ?",
                String.class,
                userId,
                perfumeId
        );
    }

    private int countShelfItems(long userId, long perfumeId) {
        return jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM user_perfumes WHERE user_id = ? AND perfume_id = ?",
                Integer.class,
                userId,
                perfumeId
        );
    }

    private int countRows(String table, String column, long id) {
        return jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM " + table + " WHERE " + column + " = ?",
                Integer.class,
                id
        );
    }

    private void clearData() {
        jdbcTemplate.update("DELETE FROM collection_perfumes");
        jdbcTemplate.update("DELETE FROM collections");
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
