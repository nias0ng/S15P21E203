package com.hyanghae.backend.shelf;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.hasSize;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
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
    private ObjectMapper objectMapper;

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

    /**
     * <b>진열대는 종이 질감 이미지를 받아야 합니다.</b>
     *
     * <p>화면 배경이 종이라 투명 배경의 일반 이미지를 얹으면 어울리지 않습니다. 고치기 전에는
     * {@code display_order} 만 봐서 일반 이미지(1번)가 항상 뽑혔습니다.
     *
     * <p>일반 이미지를 1번, 종이 질감을 2번으로 심습니다 — 실제 적재와 같은 순서라, 종류를
     * 보지 않으면 일반 이미지가 나옵니다.
     */
    /**
     * 진열대 벽의 이름표가 <b>한국어</b>로 적힙니다. 목록에 한국어명이 없으면 화면이 항목마다
     * 상세를 불러야 하는데, 한 화면에 병이 최대 25개라 요청이 25번 나갑니다.
     *
     * <p>한국어명이 없는 향수는 {@code null} 이고 화면이 영문명을 그대로 적습니다. 인계
     * 데이터에 한국어명이 아직 없는 향수가 많습니다.
     */
    @Test
    void servesKoreanNameInTheList() throws Exception {
        jdbcTemplate.update("UPDATE perfumes SET name_ko = ? WHERE perfume_id = 1", "블루 드 샤넬");

        fakeCurrentUser.login(LOGGED_IN_USER);

        mockMvc.perform(get(URL).param("category", "OWNED"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.perfumes[0].perfumeId").value(1))
                .andExpect(jsonPath("$.perfumes[0].name").value("First Scent"))
                .andExpect(jsonPath("$.perfumes[0].nameKo").value("블루 드 샤넬"))
                // 브랜드는 영문 그대로입니다. 이름표가 브랜드를 영문으로 적습니다.
                .andExpect(jsonPath("$.perfumes[0].brand").value("Test Brand"))
                // 한국어명이 없는 향수는 null 입니다.
                .andExpect(jsonPath("$.perfumes[1].nameKo").doesNotExist());
    }

    /**
     * 한국어 이름이 없는 향수는 <b>필드가 빠지는 게 아니라 {@code null} 로 실립니다.</b>
     *
     * <p>{@code jsonPath().doesNotExist()} 로는 이 둘을 구분하지 못합니다 — 값이 없을 때와
     * 키가 없을 때 모두 통과합니다. 나중에 누가 Jackson 의
     * {@code default-property-inclusion=non_null} 을 켜면 키가 통째로 사라지는데, 그래도 그
     * 단언은 계속 통과합니다. 화면이 {@code 'nameKo' in item} 으로 분기하고 있으면 그때
     * 조용히 깨집니다.
     */
    @Test
    void serializesMissingKoreanNameAsExplicitNull() throws Exception {
        fakeCurrentUser.login(LOGGED_IN_USER);

        String body = mockMvc.perform(get(URL).param("category", "OWNED"))
                .andExpect(status().isOk())
                .andReturn()
                .getResponse()
                .getContentAsString(java.nio.charset.StandardCharsets.UTF_8);

        JsonNode second = objectMapper.readTree(body).get("perfumes").get(1);

        assertThat(second.has("nameKo"))
                .as("키 자체는 있어야 합니다")
                .isTrue();
        assertThat(second.get("nameKo").isNull())
                .as("값은 null 이어야 합니다")
                .isTrue();
    }

    @Test
    void servesPaperTextureImageOnTheShelf() throws Exception {
        jdbcTemplate.update("DELETE FROM perfume_images");
        insertImage(1L, 1L, "original.png", 1, "ORIGINAL");
        insertImage(2L, 1L, "paper-texture.png", 2, "PAPER_TEXTURE");

        fakeCurrentUser.login(LOGGED_IN_USER);

        mockMvc.perform(get(URL).param("category", "OWNED"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.perfumes[0].perfumeId").value(1))
                .andExpect(jsonPath("$.perfumes[0].thumbnailUrl").value("paper-texture.png"));
    }

    /**
     * 종이 질감이 없는 향수는 일반 이미지로 넘어갑니다. 156개 향수에만 두 장이 다 있어,
     * 넘어가지 않으면 나머지가 전부 빈칸이 됩니다.
     */
    @Test
    void fallsBackToOriginalWhenPaperTextureIsMissing() throws Exception {
        jdbcTemplate.update("DELETE FROM perfume_images");
        insertImage(1L, 1L, "original-only.png", 1, "ORIGINAL");

        fakeCurrentUser.login(LOGGED_IN_USER);

        mockMvc.perform(get(URL).param("category", "OWNED"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.perfumes[0].thumbnailUrl").value("original-only.png"));
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

    private void insertPerfume(long id, long brandId, String name, String nameKo) {
        jdbcTemplate.update(
                "INSERT INTO perfumes (perfume_id, brand_id, name, name_ko, is_active) "
                        + "VALUES (?, ?, ?, ?, true)",
                id,
                brandId,
                name,
                nameKo
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

    private void insertImage(
            long id, long perfumeId, String imageUrl, int displayOrder, String imageType) {
        jdbcTemplate.update(
                "INSERT INTO perfume_images (image_id, perfume_id, image_url, display_order, image_type) "
                        + "VALUES (?, ?, ?, ?, ?)",
                id,
                perfumeId,
                imageUrl,
                displayOrder,
                imageType
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
