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
class ShelfItemListIntegrationTest {

    private static final String URL = "/api/v1/users/me/shelf-items";
    private static final long LOGGED_IN_USER = 1L;
    private static final long OTHER_USER = 2L;

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

        insertUser(LOGGED_IN_USER, "me-list@example.com", "me-list");
        insertUser(OTHER_USER, "other-list@example.com", "other-list");
        insertBrand(1L, "Test Brand");
        insertPerfume(1L, 1L, "First Scent");
        insertPerfume(2L, 1L, "Second Scent");
        insertPerfume(3L, 1L, "Third Scent");
        insertPerfume(4L, 1L, "Other User Scent");

        insertShelfItem(157L, LOGGED_IN_USER, 1L, "OWNED", "4.5", true);
        insertShelfItem(158L, LOGGED_IN_USER, 2L, "OWNED", null, null);
        insertShelfItem(159L, LOGGED_IN_USER, 3L, "WISH", "3.0", false);
        insertShelfItem(160L, OTHER_USER, 4L, "OWNED", "5.0", true);
        insertImage(1L, 1L, "secondary.jpg", 2);
        insertImage(2L, 1L, "thumbnail.jpg", 1);
    }

    @AfterEach
    void cleanUp() {
        clearData();
        fakeCurrentUser.logout();
    }

    @Test
    void returnsOnlyCurrentUsersShelfItems() throws Exception {
        fakeCurrentUser.login(LOGGED_IN_USER);

        mockMvc.perform(get(URL).param("category", "OWNED"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.perfumes", hasSize(2)))
                .andExpect(jsonPath("$.perfumes[0].shelfItemId").value(157))
                .andExpect(jsonPath("$.perfumes[0].perfumeId").value(1))
                .andExpect(jsonPath("$.perfumes[0].name").value("First Scent"))
                .andExpect(jsonPath("$.perfumes[0].brand").value("Test Brand"))
                .andExpect(jsonPath("$.perfumes[0].thumbnailUrl").value("thumbnail.jpg"))
                .andExpect(jsonPath("$.perfumes[0].category").value("OWNED"))
                .andExpect(jsonPath("$.perfumes[0].representative").value(true))
                .andExpect(jsonPath("$.perfumes[0].rating").doesNotExist())
                .andExpect(jsonPath("$.perfumes[0].memo").doesNotExist())
                .andExpect(jsonPath("$.perfumes[0].memoUpdatedAt").doesNotExist())
                .andExpect(jsonPath("$.perfumes[0].ownershipStatus").doesNotExist())
                .andExpect(jsonPath("$.perfumes[0].fitRating").doesNotExist())
                .andExpect(jsonPath("$.perfumes[1].thumbnailUrl").doesNotExist())
                .andExpect(jsonPath("$.perfumes[1].representative").value(false))
                .andExpect(jsonPath("$.page").value(0))
                .andExpect(jsonPath("$.size").value(7))
                .andExpect(jsonPath("$.totalElements").value(2));
    }

    @Test
    void pagesShelfItemsInStableOrder() throws Exception {
        fakeCurrentUser.login(LOGGED_IN_USER);

        mockMvc.perform(get(URL)
                        .param("category", "OWNED")
                        .param("page", "1")
                        .param("size", "1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.perfumes", hasSize(1)))
                .andExpect(jsonPath("$.perfumes[0].shelfItemId").value(158))
                .andExpect(jsonPath("$.page").value(1))
                .andExpect(jsonPath("$.size").value(1))
                .andExpect(jsonPath("$.totalElements").value(2));
    }

    @Test
    void returnsEmptyPageWhenShelfIsEmpty() throws Exception {
        insertUser(3L, "empty-list@example.com", "empty-list");
        fakeCurrentUser.login(3L);

        mockMvc.perform(get(URL).param("category", "TRIED"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.perfumes").isEmpty())
                .andExpect(jsonPath("$.page").value(0))
                .andExpect(jsonPath("$.size").value(7))
                .andExpect(jsonPath("$.totalElements").value(0));
    }

    @Test
    void requiresCategory() throws Exception {
        fakeCurrentUser.login(LOGGED_IN_USER);

        mockMvc.perform(get(URL))
                .andExpect(status().isBadRequest());
    }

    @Test
    void rejectsUnknownCategory() throws Exception {
        fakeCurrentUser.login(LOGGED_IN_USER);

        mockMvc.perform(get(URL).param("category", "BORROWED"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void requiresLogin() throws Exception {
        mockMvc.perform(get(URL).param("category", "OWNED"))
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

    private void insertPerfume(long id, long brandId, String name) {
        jdbcTemplate.update(
                "INSERT INTO perfumes (perfume_id, brand_id, name, is_active) "
                        + "VALUES (?, ?, ?, true)",
                id,
                brandId,
                name
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

    private void clearData() {
        jdbcTemplate.update("DELETE FROM collection_perfumes");
        jdbcTemplate.update("DELETE FROM collections");
        jdbcTemplate.update("DELETE FROM memos");
        jdbcTemplate.update("DELETE FROM user_perfumes");
        jdbcTemplate.update("DELETE FROM perfume_images");
        jdbcTemplate.update("DELETE FROM perfumes");
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
