package com.hyanghae.backend.shelf;

import static java.util.concurrent.TimeUnit.SECONDS;
import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.hyanghae.backend.global.security.CurrentUser;
import com.hyanghae.backend.shelf.exception.ShelfErrorCode;
import com.hyanghae.backend.shelf.service.RepresentativePerfumeService;
import com.hyanghae.backend.support.IntegrationTest;
import java.util.Optional;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
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
class RepresentativePerfumeIntegrationTest {

    private static final long LOGGED_IN_USER = 1L;
    private static final long OTHER_USER = 2L;
    private static final long CURRENT_REPRESENTATIVE = 154L;
    private static final long NEW_REPRESENTATIVE = 155L;
    private static final long TRIED_SHELF_ITEM = 156L;
    private static final long OTHER_USER_SHELF_ITEM = 157L;

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Autowired
    private RepresentativePerfumeService representativePerfumeService;

    @Autowired
    private FakeCurrentUser fakeCurrentUser;

    @BeforeEach
    void insertFixtures() {
        clearData();
        fakeCurrentUser.logout();

        insertUser(LOGGED_IN_USER, "me-representative@example.com", "me-representative");
        insertUser(OTHER_USER, "other-representative@example.com", "other-representative");

        insertPerfume(1L, "Current Representative");
        insertPerfume(2L, "New Representative");
        insertPerfume(3L, "Tried Scent");
        insertPerfume(4L, "Other User Scent");

        insertShelfItem(CURRENT_REPRESENTATIVE, LOGGED_IN_USER, 1L, "OWNED", true);
        insertShelfItem(NEW_REPRESENTATIVE, LOGGED_IN_USER, 2L, "OWNED", false);
        insertShelfItem(TRIED_SHELF_ITEM, LOGGED_IN_USER, 3L, "TRIED", false);
        insertShelfItem(OTHER_USER_SHELF_ITEM, OTHER_USER, 4L, "OWNED", true);
    }

    @AfterEach
    void cleanUp() {
        clearData();
        fakeCurrentUser.logout();
    }

    @Test
    void assignsNewRepresentativeAndClearsPreviousOne() throws Exception {
        fakeCurrentUser.login(LOGGED_IN_USER);

        mockMvc.perform(patch(url(NEW_REPRESENTATIVE))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"representative\":true}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.userPerfumeId").value(NEW_REPRESENTATIVE))
                .andExpect(jsonPath("$.representative").value(true))
                .andExpect(jsonPath("$.updatedAt").isNotEmpty());

        assertThat(isRepresentative(CURRENT_REPRESENTATIVE)).isFalse();
        assertThat(isRepresentative(NEW_REPRESENTATIVE)).isTrue();
        assertThat(countRepresentatives(LOGGED_IN_USER)).isEqualTo(1);
    }

    @Test
    void assignsLowerIdAfterClearingHigherIdRepresentative() throws Exception {
        jdbcTemplate.update(
                "UPDATE user_perfumes SET is_representative = false WHERE user_perfumes_id = ?",
                CURRENT_REPRESENTATIVE
        );
        jdbcTemplate.update(
                "UPDATE user_perfumes SET is_representative = true WHERE user_perfumes_id = ?",
                NEW_REPRESENTATIVE
        );
        fakeCurrentUser.login(LOGGED_IN_USER);

        mockMvc.perform(patch(url(CURRENT_REPRESENTATIVE))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"representative\":true}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.representative").value(true));

        assertThat(isRepresentative(CURRENT_REPRESENTATIVE)).isTrue();
        assertThat(isRepresentative(NEW_REPRESENTATIVE)).isFalse();
        assertThat(countRepresentatives(LOGGED_IN_USER)).isEqualTo(1);
    }

    @Test
    void clearsRepresentative() throws Exception {
        fakeCurrentUser.login(LOGGED_IN_USER);

        mockMvc.perform(patch(url(CURRENT_REPRESENTATIVE))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"representative\":false}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.userPerfumeId").value(CURRENT_REPRESENTATIVE))
                .andExpect(jsonPath("$.representative").value(false))
                .andExpect(jsonPath("$.updatedAt").isNotEmpty());

        assertThat(countRepresentatives(LOGGED_IN_USER)).isZero();
    }

    @Test
    void allowsRepeatedUnassignRequest() throws Exception {
        fakeCurrentUser.login(LOGGED_IN_USER);

        mockMvc.perform(patch(url(NEW_REPRESENTATIVE))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"representative\":false}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.representative").value(false));

        assertThat(countRepresentatives(LOGGED_IN_USER)).isEqualTo(1);
    }

    @Test
    void rejectsNonOwnedPerfumeAsRepresentative() throws Exception {
        fakeCurrentUser.login(LOGGED_IN_USER);

        mockMvc.perform(patch(url(TRIED_SHELF_ITEM))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"representative\":true}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code")
                        .value(ShelfErrorCode.SHELF_REPRESENTATIVE_REQUIRES_OWNED.code()));

        assertThat(countRepresentatives(LOGGED_IN_USER)).isEqualTo(1);
    }

    @Test
    void requiresLogin() throws Exception {
        mockMvc.perform(patch(url(NEW_REPRESENTATIVE))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"representative\":true}"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value(ShelfErrorCode.SHELF_LOGIN_REQUIRED.code()));
    }

    @Test
    void hidesOtherUsersShelfItem() throws Exception {
        fakeCurrentUser.login(LOGGED_IN_USER);

        mockMvc.perform(patch(url(OTHER_USER_SHELF_ITEM))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"representative\":false}"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value(ShelfErrorCode.SHELF_ITEM_NOT_FOUND.code()));

        assertThat(isRepresentative(OTHER_USER_SHELF_ITEM)).isTrue();
    }

    @Test
    void rejectsMissingRepresentativeValue() throws Exception {
        fakeCurrentUser.login(LOGGED_IN_USER);

        mockMvc.perform(patch(url(NEW_REPRESENTATIVE))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{}"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void keepsOneRepresentativeWhenTwoAssignmentsRunConcurrently() throws Exception {
        fakeCurrentUser.login(LOGGED_IN_USER);
        CountDownLatch ready = new CountDownLatch(2);
        CountDownLatch start = new CountDownLatch(1);

        try (ExecutorService executor = Executors.newFixedThreadPool(2)) {
            Future<?> first = executor.submit(
                    () -> assignAfterSignal(CURRENT_REPRESENTATIVE, ready, start));
            Future<?> second = executor.submit(
                    () -> assignAfterSignal(NEW_REPRESENTATIVE, ready, start));

            assertThat(ready.await(5, SECONDS)).isTrue();
            start.countDown();
            first.get(10, SECONDS);
            second.get(10, SECONDS);
        }

        assertThat(countRepresentatives(LOGGED_IN_USER)).isEqualTo(1);
    }

    private void assignAfterSignal(
            long userPerfumeId,
            CountDownLatch ready,
            CountDownLatch start
    ) {
        ready.countDown();
        try {
            start.await();
            representativePerfumeService.update(userPerfumeId, true);
        } catch (InterruptedException exception) {
            Thread.currentThread().interrupt();
            throw new IllegalStateException(exception);
        }
    }

    private String url(long shelfItemId) {
        return "/api/v1/users/me/shelf-items/" + shelfItemId + "/representative";
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

    private Boolean isRepresentative(long userPerfumeId) {
        return jdbcTemplate.queryForObject(
                "SELECT is_representative FROM user_perfumes WHERE user_perfumes_id = ?",
                Boolean.class,
                userPerfumeId
        );
    }

    private Integer countRepresentatives(long userId) {
        return jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM user_perfumes WHERE user_id = ? AND is_representative = true",
                Integer.class,
                userId
        );
    }

    private void clearData() {
        jdbcTemplate.update("DELETE FROM personal_records");
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
