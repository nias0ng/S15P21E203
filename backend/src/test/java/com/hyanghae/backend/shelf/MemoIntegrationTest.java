package com.hyanghae.backend.shelf;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
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
class MemoIntegrationTest {

    private static final String URL =
            "/api/v1/users/me/shelf-items/{shelfItemId}/memo";
    private static final long LOGGED_IN_USER = 1L;
    private static final long OTHER_USER = 2L;
    private static final long SHELF_ITEM_ID = 185L;

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

        insertUser(LOGGED_IN_USER, "me-record@example.com", "me-record");
        insertUser(OTHER_USER, "other-record@example.com", "other-record");
        insertPerfume(1L, "Record Scent");
        insertShelfItem(SHELF_ITEM_ID, LOGGED_IN_USER, 1L);
        insertShelfItem(186L, OTHER_USER, 1L);
    }

    @AfterEach
    void cleanUp() {
        clearData();
        fakeCurrentUser.logout();
    }

    @Test
    void createsMemo() throws Exception {
        fakeCurrentUser.login(LOGGED_IN_USER);

        mockMvc.perform(post(URL, SHELF_ITEM_ID)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"content\":\"비 오는 날 잔향이 좋았다.\"}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.memoId").isNumber())
                .andExpect(jsonPath("$.content").value("비 오는 날 잔향이 좋았다."))
                .andExpect(jsonPath("$.testedAt").doesNotExist())
                .andExpect(jsonPath("$.createdAt").isNotEmpty())
                .andExpect(jsonPath("$.updatedAt").doesNotExist());

        Integer count = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM memos WHERE user_perfume_id = ?",
                Integer.class,
                SHELF_ITEM_ID
        );
        assertThat(count).isEqualTo(1);
    }

    @Test
    void rejectsDuplicateMemo() throws Exception {
        insertMemo(1L, SHELF_ITEM_ID, "기존 기록");
        fakeCurrentUser.login(LOGGED_IN_USER);

        mockMvc.perform(post(URL, SHELF_ITEM_ID)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"content\":\"새 기록\"}"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value(
                        ShelfErrorCode.SHELF_MEMO_ALREADY_EXISTS.code()
                ));
    }

    @Test
    void returnsMemo() throws Exception {
        insertMemo(1L, SHELF_ITEM_ID, "조회할 기록");
        fakeCurrentUser.login(LOGGED_IN_USER);

        mockMvc.perform(get(URL, SHELF_ITEM_ID))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.memoId").value(1))
                .andExpect(jsonPath("$.content").value("조회할 기록"))
                .andExpect(jsonPath("$.testedAt").doesNotExist())
                .andExpect(jsonPath("$.createdAt").value("2026-09-01T01:00:00Z"))
                .andExpect(jsonPath("$.updatedAt").value("2026-09-01T01:00:00Z"));
    }

    @Test
    void updatesOnlyContent() throws Exception {
        insertMemo(1L, SHELF_ITEM_ID, "수정 전");
        fakeCurrentUser.login(LOGGED_IN_USER);

        mockMvc.perform(patch(URL, SHELF_ITEM_ID)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"content\":\"수정 후\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.memoId").value(1))
                .andExpect(jsonPath("$.content").value("수정 후"))
                .andExpect(jsonPath("$.testedAt").doesNotExist())
                .andExpect(jsonPath("$.updatedAt").isNotEmpty())
                .andExpect(jsonPath("$.createdAt").doesNotExist());
    }

    @Test
    void deletesMemoPhysically() throws Exception {
        insertMemo(1L, SHELF_ITEM_ID, "삭제할 기록");
        fakeCurrentUser.login(LOGGED_IN_USER);

        mockMvc.perform(delete(URL, SHELF_ITEM_ID))
                .andExpect(status().isNoContent());

        Integer count = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM memos WHERE user_perfume_id = ?",
                Integer.class,
                SHELF_ITEM_ID
        );
        assertThat(count).isZero();
    }

    @Test
    void hidesOtherUsersMemo() throws Exception {
        insertMemo(1L, 186L, "다른 사용자 기록");
        fakeCurrentUser.login(LOGGED_IN_USER);

        mockMvc.perform(get(URL, 186L))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value(
                        ShelfErrorCode.SHELF_MEMO_NOT_FOUND.code()
                ));
    }

    @Test
    void rejectsBlankContent() throws Exception {
        fakeCurrentUser.login(LOGGED_IN_USER);

        mockMvc.perform(post(URL, SHELF_ITEM_ID)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"content\":\"   \"}"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void requiresLogin() throws Exception {
        mockMvc.perform(get(URL, SHELF_ITEM_ID))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value(ShelfErrorCode.SHELF_LOGIN_REQUIRED.code()));
    }

    private void insertUser(long id, String email, String nickname) {
        jdbcTemplate.update(
                "INSERT INTO users (user_id, email, password_hash, nickname) VALUES (?, ?, 'x', ?)",
                id,
                email,
                nickname
        );
    }

    private void insertPerfume(long id, String name) {
        jdbcTemplate.update(
                "INSERT INTO perfumes (perfume_id, name, is_active) VALUES (?, ?, true)",
                id,
                name
        );
    }

    private void insertShelfItem(long id, long userId, long perfumeId) {
        jdbcTemplate.update(
                "INSERT INTO user_perfumes "
                        + "(user_perfumes_id, user_id, perfume_id, ownership_status, "
                        + "is_representative) VALUES (?, ?, ?, 'TRIED', false)",
                id,
                userId,
                perfumeId
        );
    }

    private void insertMemo(long id, long shelfItemId, String content) {
        jdbcTemplate.update(
                "INSERT INTO memos "
                        + "(memo_id, user_perfume_id, content, created_at, updated_at) "
                        + "VALUES (?, ?, ?, '2026-09-01T10:00:00+09:00'::timestamptz, "
                        + "'2026-09-01T10:00:00+09:00'::timestamptz)",
                id,
                shelfItemId,
                content
        );
    }

    private void clearData() {
        jdbcTemplate.update("DELETE FROM collection_perfumes");
        jdbcTemplate.update("DELETE FROM collections");
        jdbcTemplate.update("DELETE FROM memos");
        jdbcTemplate.update("DELETE FROM user_perfumes");
        jdbcTemplate.update("DELETE FROM perfume_notes");
        jdbcTemplate.update("DELETE FROM perfume_images");
        jdbcTemplate.update("DELETE FROM perfumes");
        jdbcTemplate.update("DELETE FROM notes");
        jdbcTemplate.update("DELETE FROM brands");
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
