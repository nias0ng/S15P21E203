package com.hyanghae.backend.collection;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.hyanghae.backend.global.security.CurrentUser;
import com.hyanghae.backend.support.IntegrationTest;
import jakarta.persistence.EntityManagerFactory;
import java.util.List;
import java.util.Optional;
import org.hibernate.SessionFactory;
import org.hibernate.stat.Statistics;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Primary;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

/**
 * 컬렉션 목록의 미리보기 사진을 검증합니다.
 *
 * <p>이 기능이 생긴 이유가 <b>N+1 제거</b>라, 값이 맞는지만큼 <b>쿼리가 컬렉션 수만큼 늘지
 * 않는지</b>가 중요합니다. 값만 보는 테스트는 컬렉션마다 따로 조회하도록 되돌려도 통과합니다.
 *
 * <p>사진이 없는 향수는 자리를 지키기 위해 {@code null} 로 담깁니다. 빼 버리면 화면이 세 칸 중
 * 어느 칸이 비었는지 알 수 없습니다.
 */
@IntegrationTest
@AutoConfigureMockMvc
@ActiveProfiles({"manual-test", "test"})
class CollectionPreviewThumbnailIntegrationTest {

    private static final String URL = "/api/v1/users/me/collections";
    private static final long USER_ID = 1;

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Autowired
    private FakeCurrentUser currentUser;

    @Autowired
    private EntityManagerFactory entityManagerFactory;

    @BeforeEach
    void setUp() {
        clearData();
        jdbcTemplate.update(
                "INSERT INTO users (user_id, email, password_hash, nickname) VALUES (?, ?, 'x', ?)",
                USER_ID, "me@hyanghae.test", "나");
        currentUser.login(USER_ID);
    }

    @AfterEach
    void tearDown() {
        currentUser.logout();
        clearData();
    }

    /**
     * 담긴 순서대로 최대 세 장이 실립니다. 상세와 같은 순서여야 화면이 어긋나지 않습니다.
     */
    @Test
    void fillsUpToThreeThumbnailsInInsertionOrder() throws Exception {
        insertPerfume(1, "first.png");
        insertPerfume(2, "second.png");
        insertPerfume(3, "third.png");
        insertPerfume(4, "fourth.png");
        long collectionId = insertCollection(10, "네 개짜리");
        addPerfume(collectionId, 1, 0);
        addPerfume(collectionId, 2, 1);
        addPerfume(collectionId, 3, 2);
        addPerfume(collectionId, 4, 3);

        mockMvc.perform(get(URL))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.collections[0].perfumeCount").value(4))
                .andExpect(jsonPath("$.collections[0].previewThumbnails.length()").value(3))
                .andExpect(jsonPath("$.collections[0].previewThumbnails[0]").value("first.png"))
                .andExpect(jsonPath("$.collections[0].previewThumbnails[1]").value("second.png"))
                .andExpect(jsonPath("$.collections[0].previewThumbnails[2]").value("third.png"));
    }

    /**
     * <b>사진이 없는 향수는 {@code null} 로 자리를 지킵니다.</b> 빼 버리면 세 칸 중 어느 칸이
     * 비었는지 화면이 알 수 없고, 뒤의 향수가 앞으로 당겨져 상세와 순서가 어긋납니다.
     */
    @Test
    void keepsNullSlotsForPerfumesWithoutImages() throws Exception {
        insertPerfume(1, "first.png");
        insertPerfume(2, null);
        insertPerfume(3, "third.png");
        long collectionId = insertCollection(10, "가운데가 빈");
        addPerfume(collectionId, 1, 0);
        addPerfume(collectionId, 2, 1);
        addPerfume(collectionId, 3, 2);

        mockMvc.perform(get(URL))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.collections[0].previewThumbnails.length()").value(3))
                .andExpect(jsonPath("$.collections[0].previewThumbnails[0]").value("first.png"))
                .andExpect(jsonPath("$.collections[0].previewThumbnails[1]").doesNotExist())
                .andExpect(jsonPath("$.collections[0].previewThumbnails[2]").value("third.png"));
    }

    /**
     * <b>컬렉션 카드도 종이 질감 이미지를 받아야 합니다.</b> 진열대 화면 아래에 붙는 카드라
     * 같은 종이 배경 위에 놓입니다.
     *
     * <p>일반 이미지를 1번, 종이 질감을 2번으로 심습니다 — 실제 적재와 같은 순서라, 종류를
     * 보지 않으면 일반 이미지가 나옵니다.
     */
    @Test
    void servesPaperTextureThumbnails() throws Exception {
        jdbcTemplate.update("""
                INSERT INTO perfumes (perfume_id, name) VALUES (9, '두 장 다 있는 향수')
                """);
        jdbcTemplate.update("""
                INSERT INTO user_perfumes (user_perfumes_id, user_id, perfume_id)
                VALUES (9, ?, 9)
                """, USER_ID);
        jdbcTemplate.update("""
                INSERT INTO perfume_images (perfume_id, image_url, display_order, image_type)
                VALUES (9, 'original.png', 1, 'ORIGINAL'),
                       (9, 'paper-texture.png', 2, 'PAPER_TEXTURE')
                """);
        long collectionId = insertCollection(10, "종이 질감");
        addPerfume(collectionId, 9, 0);

        mockMvc.perform(get(URL))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.collections[0].previewThumbnails[0]")
                        .value("paper-texture.png"));
    }

    /**
     * 담긴 향수가 셋보다 적으면 배열도 짧습니다. 화면이 남은 자리를 채웁니다.
     */
    @Test
    void returnsShorterArrayWhenCollectionHasFewerPerfumes() throws Exception {
        insertPerfume(1, "only.png");
        long collectionId = insertCollection(10, "하나짜리");
        addPerfume(collectionId, 1, 0);

        mockMvc.perform(get(URL))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.collections[0].previewThumbnails.length()").value(1))
                .andExpect(jsonPath("$.collections[0].previewThumbnails[0]").value("only.png"));
    }

    /**
     * 아무것도 담기지 않은 컬렉션은 빈 배열입니다. {@code null} 이 아니어야 화면이 그대로
     * 순회할 수 있습니다.
     */
    @Test
    void returnsEmptyArrayForCollectionWithoutPerfumes() throws Exception {
        insertCollection(10, "빈 컬렉션");

        mockMvc.perform(get(URL))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.collections[0].previewThumbnails").isArray())
                .andExpect(jsonPath("$.collections[0].previewThumbnails.length()").value(0));
    }

    /**
     * <b>이 기능이 생긴 이유입니다.</b> 컬렉션이 늘어도 쿼리 수가 늘지 않아야 합니다.
     *
     * <p>값만 보는 테스트는 컬렉션마다 따로 조회하도록 되돌려도 전부 통과합니다. 여기서 실제
     * 쿼리 수를 세어, 되돌아가면 바로 드러나게 합니다.
     *
     * <p>정확한 숫자가 아니라 <b>늘어나지 않는다는 것</b>을 봅니다. 쿼리 수를 못 박으면 무관한
     * 최적화에도 테스트가 깨집니다.
     */
    @Test
    void doesNotRunMoreQueriesAsCollectionsGrow() throws Exception {
        insertPerfume(1, "a.png");
        insertPerfume(2, "b.png");

        long withOneCollection = countQueriesWhileListing(1);
        long withTenCollections = countQueriesWhileListing(10);

        // 통계가 꺼져 있으면 둘 다 0 이라 아래 비교가 저절로 통과합니다. 세고 있다는 것부터
        // 확인해야 이 테스트가 의미를 가집니다.
        assertThat(withOneCollection)
                .as("쿼리를 실제로 세고 있어야 합니다")
                .isPositive();
        assertThat(withTenCollections)
                .as("컬렉션이 10배로 늘어도 쿼리 수는 그대로여야 합니다 (실제 %d → %d)",
                        withOneCollection, withTenCollections)
                .isEqualTo(withOneCollection);
    }

    /**
     * 컬렉션 {@code count} 개를 새로 깔고 목록을 한 번 조회하며 나간 쿼리 수를 셉니다.
     */
    private long countQueriesWhileListing(int count) throws Exception {
        jdbcTemplate.update("DELETE FROM collection_perfumes");
        jdbcTemplate.update("DELETE FROM collections");
        for (int index = 0; index < count; index++) {
            long collectionId = insertCollection(100 + index, "컬렉션 " + index);
            addPerfume(collectionId, 1, 0);
            addPerfume(collectionId, 2, 1);
        }

        Statistics statistics = entityManagerFactory
                .unwrap(SessionFactory.class)
                .getStatistics();
        statistics.setStatisticsEnabled(true);
        statistics.clear();

        mockMvc.perform(get(URL).param("size", "100"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.collections.length()").value(count));

        return statistics.getPrepareStatementCount();
    }

    private long insertCollection(long id, String name) {
        jdbcTemplate.update("""
                INSERT INTO collections (collection_id, user_id, name, description, created_at, updated_at)
                VALUES (?, ?, ?, NULL, now(), now())
                """, id, USER_ID, name);
        return id;
    }

    /**
     * 향수와 진열대 항목을 함께 넣습니다. 컬렉션은 향수가 아니라 <b>진열대 항목</b>을 담으므로
     * 둘 다 있어야 합니다. {@code imageUrl} 이 {@code null} 이면 이미지 행을 만들지 않습니다.
     */
    private void insertPerfume(long perfumeId, String imageUrl) {
        jdbcTemplate.update(
                "INSERT INTO perfumes (perfume_id, name) VALUES (?, ?)", perfumeId, "향수 " + perfumeId);
        jdbcTemplate.update("""
                INSERT INTO user_perfumes (user_perfumes_id, user_id, perfume_id)
                VALUES (?, ?, ?)
                """, perfumeId, USER_ID, perfumeId);
        if (imageUrl != null) {
            jdbcTemplate.update("""
                    INSERT INTO perfume_images (perfume_id, image_url, display_order, image_type)
                    VALUES (?, ?, 1, 'ORIGINAL')
                    """, perfumeId, imageUrl);
        }
    }

    private void addPerfume(long collectionId, long shelfItemId, int displayOrder) {
        jdbcTemplate.update("""
                INSERT INTO collection_perfumes (collection_id, user_perfume_id, display_order)
                VALUES (?, ?, ?)
                """, collectionId, shelfItemId, displayOrder);
    }

    private void clearData() {
        List.of(
                "DELETE FROM collection_perfumes",
                "DELETE FROM collections",
                "DELETE FROM memos",
                "DELETE FROM perfume_images",
                "DELETE FROM user_perfumes",
                "DELETE FROM perfumes",
                "DELETE FROM users"
        ).forEach(jdbcTemplate::update);
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
