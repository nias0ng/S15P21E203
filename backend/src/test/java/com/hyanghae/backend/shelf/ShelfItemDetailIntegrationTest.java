package com.hyanghae.backend.shelf;

import static org.hamcrest.Matchers.hasSize;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
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
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;

@IntegrationTest
@AutoConfigureMockMvc
class ShelfItemDetailIntegrationTest {

    private static final String URL = "/api/v1/users/me/shelf-items/{shelfItemId}";
    private static final long LOGGED_IN_USER = 1L;
    private static final long OTHER_USER = 2L;
    private static final long SHELF_ITEM_ID = 157L;

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

        insertUser(LOGGED_IN_USER, "me-detail@example.com", "me-detail");
        insertUser(OTHER_USER, "other-detail@example.com", "other-detail");
        insertBrand(1L, "Chanel");
        insertPerfume(1L, 1L, "Coco Mademoiselle", "코코 마드모아젤");
        insertPerfume(2L, null, "No Optional Data", null);
        insertShelfItem(SHELF_ITEM_ID, LOGGED_IN_USER, 1L, "OWNED", "4.5", true);
        insertShelfItem(158L, LOGGED_IN_USER, 2L, "WISH", null, null);
        insertShelfItem(159L, OTHER_USER, 1L, "TRIED", "3.0", false);

        insertImage(1L, 1L, "secondary.jpg", 2);
        insertImage(2L, 1L, "thumbnail.jpg", 1);
        insertNote(1L, "Orange");
        insertNote(2L, "Rose");
        insertNote(3L, "Patchouli");
        insertPerfumeNote(1L, 1L, "TOP");
        insertPerfumeNote(1L, 2L, "MIDDLE");
        insertPerfumeNote(1L, 3L, "BASE");
        insertMemo(
                1L,
                SHELF_ITEM_ID,
                "비 오는 날 잔향이 오래 남는다.",
                "2026-09-01T10:00:00+09:00",
                "2026-09-10T11:30:00+09:00"
        );
    }

    @AfterEach
    void cleanUp() {
        clearData();
        fakeCurrentUser.logout();
    }

    @Test
    void returnsShelfItemDetail() throws Exception {
        fakeCurrentUser.login(LOGGED_IN_USER);

        mockMvc.perform(get(URL, SHELF_ITEM_ID))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.shelfItemId").value(SHELF_ITEM_ID))
                .andExpect(jsonPath("$.perfumeId").value(1))
                .andExpect(jsonPath("$.name").value("Coco Mademoiselle"))
                .andExpect(jsonPath("$.nameKo").value("코코 마드모아젤"))
                .andExpect(jsonPath("$.brand").value("Chanel"))
                .andExpect(jsonPath("$.thumbnailUrl").value("thumbnail.jpg"))
                .andExpect(jsonPath("$.category").value("OWNED"))
                .andExpect(jsonPath("$.rating").value(4.5))
                .andExpect(jsonPath("$.representative").value(true))
                .andExpect(jsonPath("$.scentNotes", hasSize(3)))
                .andExpect(jsonPath("$.scentNotes[0].noteId").value(1))
                .andExpect(jsonPath("$.scentNotes[0].name").value("Orange"))
                .andExpect(jsonPath("$.scentNotes[0].noteType").value("TOP"))
                .andExpect(jsonPath("$.scentNotes[1].noteType").value("BASE"))
                .andExpect(jsonPath("$.scentNotes[2].noteType").value("MIDDLE"))
                .andExpect(jsonPath("$.memo").value("비 오는 날 잔향이 오래 남는다."))
                .andExpect(jsonPath("$.memoUpdatedAt").value("2026-09-10T02:30:00Z"));
    }

    @Test
    void returnsEmptyOptionalDetailData() throws Exception {
        fakeCurrentUser.login(LOGGED_IN_USER);

        mockMvc.perform(get(URL, 158L))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.shelfItemId").value(158))
                .andExpect(jsonPath("$.name").value("No Optional Data"))
                .andExpect(jsonPath("$.nameKo").doesNotExist())
                .andExpect(jsonPath("$.brand").doesNotExist())
                .andExpect(jsonPath("$.thumbnailUrl").doesNotExist())
                .andExpect(jsonPath("$.rating").doesNotExist())
                .andExpect(jsonPath("$.representative").value(false))
                .andExpect(jsonPath("$.scentNotes").isEmpty())
                .andExpect(jsonPath("$.memo").doesNotExist())
                .andExpect(jsonPath("$.memoUpdatedAt").doesNotExist());
    }

    @Test
    void hidesOtherUsersShelfItem() throws Exception {
        fakeCurrentUser.login(LOGGED_IN_USER);

        mockMvc.perform(get(URL, 159L))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value(ShelfErrorCode.SHELF_ITEM_NOT_FOUND.code()));
    }

    @Test
    void returnsNotFoundForUnknownShelfItem() throws Exception {
        fakeCurrentUser.login(LOGGED_IN_USER);

        mockMvc.perform(get(URL, 999L))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value(ShelfErrorCode.SHELF_ITEM_NOT_FOUND.code()));
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

    private void insertBrand(long id, String name) {
        jdbcTemplate.update(
                "INSERT INTO brands (brand_id, name, is_active) VALUES (?, ?, true)",
                id,
                name
        );
    }

    private void insertPerfume(Long id, Long brandId, String name, String nameKo) {
        jdbcTemplate.update(
                "INSERT INTO perfumes (perfume_id, brand_id, name, name_ko, is_active) "
                        + "VALUES (?, ?, ?, ?, true)",
                id,
                brandId,
                name,
                nameKo
        );
    }

    private void insertShelfItem(
            long id,
            long userId,
            long perfumeId,
            String ownershipStatus,
            String fitRating,
            Boolean representative
    ) {
        jdbcTemplate.update(
                "INSERT INTO user_perfumes "
                        + "(user_perfumes_id, user_id, perfume_id, ownership_status, "
                        + "fit_rating, is_representative) VALUES (?, ?, ?, ?, ?::numeric, ?)",
                id,
                userId,
                perfumeId,
                ownershipStatus,
                fitRating,
                representative
        );
    }

    private void insertImage(long id, long perfumeId, String imageUrl, int displayOrder) {
        jdbcTemplate.update(
                "INSERT INTO perfume_images (image_id, perfume_id, image_url, display_order) "
                        + "VALUES (?, ?, ?, ?)",
                id,
                perfumeId,
                imageUrl,
                displayOrder
        );
    }

    private void insertNote(long id, String name) {
        jdbcTemplate.update(
                "INSERT INTO notes (note_id, name, is_active) VALUES (?, ?, true)",
                id,
                name
        );
    }

    private void insertPerfumeNote(long perfumeId, long noteId, String noteType) {
        jdbcTemplate.update(
                "INSERT INTO perfume_notes (perfume_id, note_id, note_type) VALUES (?, ?, ?)",
                perfumeId,
                noteId,
                noteType
        );
    }

    private void insertMemo(
            long id,
            long shelfItemId,
            String content,
            String createdAt,
            String updatedAt
    ) {
        jdbcTemplate.update(
                "INSERT INTO personal_records "
                        + "(id, user_perfume_id, content, created_at, updated_at) "
                        + "VALUES (?, ?, ?, ?::timestamptz, ?::timestamptz)",
                id,
                shelfItemId,
                content,
                createdAt,
                updatedAt
        );
    }

    private void clearData() {
        jdbcTemplate.update("DELETE FROM collection_perfumes");
        jdbcTemplate.update("DELETE FROM collections");
        jdbcTemplate.update("DELETE FROM personal_records");
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
