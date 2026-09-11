package com.hyanghae.backend.shelf;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.hyanghae.backend.global.security.CurrentUser;
import com.hyanghae.backend.shelf.exception.ShelfErrorCode;
import com.hyanghae.backend.support.IntegrationTest;
import java.math.BigDecimal;
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
class FitRatingIntegrationTest {

    private static final long LOGGED_IN_USER = 1L;
    private static final long OTHER_USER = 2L;
    private static final long MY_SHELF_ITEM = 151L;
    private static final long OTHER_SHELF_ITEM = 152L;

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

        insertUser(LOGGED_IN_USER, "me-fit-rating@example.com", "me-fit-rating");
        insertUser(OTHER_USER, "other-fit-rating@example.com", "other-fit-rating");
        insertPerfume(1L, "My Scent");
        insertPerfume(2L, "Other Scent");
        insertShelfItem(MY_SHELF_ITEM, LOGGED_IN_USER, 1L, null);
        insertShelfItem(OTHER_SHELF_ITEM, OTHER_USER, 2L, new BigDecimal("3.0"));
    }

    @AfterEach
    void cleanUp() {
        clearData();
        fakeCurrentUser.logout();
    }

    @Test
    void registersFitRating() throws Exception {
        fakeCurrentUser.login(LOGGED_IN_USER);

        mockMvc.perform(put(url(MY_SHELF_ITEM))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"fitRating\":4.5}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.userPerfumeId").value(MY_SHELF_ITEM))
                .andExpect(jsonPath("$.fitRating").value(4.5))
                .andExpect(jsonPath("$.updatedAt").isNotEmpty());

        assertThat(findFitRating(MY_SHELF_ITEM)).isEqualByComparingTo("4.5");
    }

    @Test
    void updatesExistingFitRating() throws Exception {
        jdbcTemplate.update(
                "UPDATE user_perfumes SET fit_rating = 2.0 WHERE user_perfumes_id = ?",
                MY_SHELF_ITEM
        );
        fakeCurrentUser.login(LOGGED_IN_USER);

        mockMvc.perform(put(url(MY_SHELF_ITEM))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"fitRating\":5.0}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.fitRating").value(5.0));

        assertThat(findFitRating(MY_SHELF_ITEM)).isEqualByComparingTo("5.0");
    }

    @Test
    void deletesFitRatingWithoutDeletingShelfItem() throws Exception {
        jdbcTemplate.update(
                "UPDATE user_perfumes SET fit_rating = 4.0 WHERE user_perfumes_id = ?",
                MY_SHELF_ITEM
        );
        fakeCurrentUser.login(LOGGED_IN_USER);

        mockMvc.perform(delete(url(MY_SHELF_ITEM)))
                .andExpect(status().isNoContent());

        assertThat(findFitRating(MY_SHELF_ITEM)).isNull();
        assertThat(countShelfItem(MY_SHELF_ITEM)).isEqualTo(1);
    }

    @Test
    void deleteIsIdempotentWhenFitRatingIsAlreadyEmpty() throws Exception {
        fakeCurrentUser.login(LOGGED_IN_USER);

        mockMvc.perform(delete(url(MY_SHELF_ITEM)))
                .andExpect(status().isNoContent());

        assertThat(countShelfItem(MY_SHELF_ITEM)).isEqualTo(1);
    }

    @Test
    void rejectsRequestWithoutLogin() throws Exception {
        mockMvc.perform(put(url(MY_SHELF_ITEM))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"fitRating\":4.5}"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value(ShelfErrorCode.SHELF_LOGIN_REQUIRED.code()));
    }

    @Test
    void hidesOtherUsersShelfItem() throws Exception {
        fakeCurrentUser.login(LOGGED_IN_USER);

        mockMvc.perform(delete(url(OTHER_SHELF_ITEM)))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value(ShelfErrorCode.SHELF_ITEM_NOT_FOUND.code()));

        assertThat(findFitRating(OTHER_SHELF_ITEM)).isEqualByComparingTo("3.0");
    }

    @Test
    void rejectsFitRatingOutsideRange() throws Exception {
        fakeCurrentUser.login(LOGGED_IN_USER);

        mockMvc.perform(put(url(MY_SHELF_ITEM))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"fitRating\":5.5}"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void rejectsFitRatingThatIsNotHalfPointStep() throws Exception {
        fakeCurrentUser.login(LOGGED_IN_USER);

        mockMvc.perform(put(url(MY_SHELF_ITEM))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"fitRating\":4.7}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code")
                        .value(ShelfErrorCode.SHELF_INVALID_FIT_RATING.code()));
    }

    @Test
    void rejectsMissingFitRating() throws Exception {
        fakeCurrentUser.login(LOGGED_IN_USER);

        mockMvc.perform(put(url(MY_SHELF_ITEM))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{}"))
                .andExpect(status().isBadRequest());
    }

    private String url(long shelfItemId) {
        return "/api/v1/users/me/shelf-items/" + shelfItemId + "/fit-rating";
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
            long id, long userId, long perfumeId, BigDecimal fitRating
    ) {
        jdbcTemplate.update(
                "INSERT INTO user_perfumes "
                        + "(user_perfumes_id, user_id, perfume_id, ownership_status, fit_rating) "
                        + "VALUES (?, ?, ?, 'TRIED', ?)",
                id, userId, perfumeId, fitRating
        );
    }

    private BigDecimal findFitRating(long userPerfumeId) {
        return jdbcTemplate.queryForObject(
                "SELECT fit_rating FROM user_perfumes WHERE user_perfumes_id = ?",
                BigDecimal.class,
                userPerfumeId
        );
    }

    private Integer countShelfItem(long userPerfumeId) {
        return jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM user_perfumes WHERE user_perfumes_id = ?",
                Integer.class,
                userPerfumeId
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
