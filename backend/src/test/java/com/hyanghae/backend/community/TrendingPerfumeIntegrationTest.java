package com.hyanghae.backend.community;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.hyanghae.backend.support.IntegrationTest;
import java.time.OffsetDateTime;
import java.util.List;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

/**
 * 지금 많이 언급되는 향수를 검증합니다.
 *
 * <p><b>기간이 이 기능의 본론입니다.</b> 세는 값 자체는 단순한 집계라 틀리기 어렵지만, 기간을
 * 잘못 자르면 몇 달 전 글이 계속 순위에 남습니다. 경계 바깥의 글을 일부러 심어 확인합니다.
 *
 * <p>향수 검색의 인기 순과 다른 값이라 대신할 수 없습니다 — 그쪽은 담거나 열어 본 횟수이고
 * 이쪽은 글에 걸린 횟수입니다.
 */
@IntegrationTest
@AutoConfigureMockMvc
@ActiveProfiles({"manual-test", "test"})
class TrendingPerfumeIntegrationTest {

    private static final String URL = "/api/v1/posts/trending-perfumes";

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @BeforeEach
    void insertFixtures() {
        clearData();
        jdbcTemplate.update("""
                INSERT INTO users (user_id, email, password_hash, nickname)
                VALUES (1, 'writer@hyanghae.test', 'x', '글쓴이')
                """);
        jdbcTemplate.update("INSERT INTO brands (brand_id, name, is_active) VALUES (1, 'Chanel', TRUE)");
        insertPerfume(1, 1L, "인기 향수", true);
        insertPerfume(2, 1L, "보통 향수", true);
        insertPerfume(3, null, "브랜드 없는 향수", true);
        insertPerfume(4, 1L, "내려간 향수", false);
        jdbcTemplate.update("""
                INSERT INTO perfume_images (perfume_id, image_url, display_order, image_type)
                VALUES (1, 'https://img.example.com/one.png', 1, 'ORIGINAL')
                """);
    }

    @AfterEach
    void cleanUp() {
        clearData();
    }

    /**
     * 많이 걸린 순으로 나오고, 카드에 실릴 값이 모두 담깁니다.
     *
     * <p>이미지가 없는 향수는 {@code thumbnailUrl} 이 비고, 브랜드가 없는 향수는 {@code brand}
     * 가 빕니다. 둘 다 인계 데이터에 실제로 있습니다.
     */
    @Test
    void ranksPerfumesByHowManyPostsMentionThem() throws Exception {
        long recentA = insertPost(1, "최근 글 하나", 1);
        long recentB = insertPost(2, "최근 글 둘", 2);
        long recentC = insertPost(3, "최근 글 셋", 3);
        mention(recentA, 1);
        mention(recentB, 1);
        mention(recentC, 1);
        mention(recentA, 2);
        mention(recentB, 3);

        mockMvc.perform(get(URL))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.days").value(7))
                .andExpect(jsonPath("$.perfumes.length()").value(3))
                .andExpect(jsonPath("$.perfumes[0].perfumeId").value(1))
                .andExpect(jsonPath("$.perfumes[0].name").value("인기 향수"))
                .andExpect(jsonPath("$.perfumes[0].brand").value("Chanel"))
                .andExpect(jsonPath("$.perfumes[0].thumbnailUrl")
                        .value("https://img.example.com/one.png"))
                .andExpect(jsonPath("$.perfumes[0].mentionCount").value(3))
                .andExpect(jsonPath("$.perfumes[1].mentionCount").value(1))
                .andExpect(jsonPath("$.perfumes[2].mentionCount").value(1));
    }

    /**
     * <b>기간 밖의 글은 세지 않습니다.</b> 자르지 않으면 몇 달 전 글이 계속 순위에 남아
     * "지금 많이 언급되는" 이 아니게 됩니다.
     *
     * <p>8일 전 글에 2번을 다섯 번 걸어 둡니다. 기간을 안 자르면 2번이 1등이 됩니다.
     */
    @Test
    void ignoresPostsOlderThanAWeek() throws Exception {
        long recent = insertPost(1, "최근 글", 1);
        mention(recent, 1);

        for (int index = 0; index < 5; index++) {
            long old = insertPost(100 + index, "지난달 글 " + index, 8);
            mention(old, 2);
        }

        mockMvc.perform(get(URL))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.perfumes.length()").value(1))
                .andExpect(jsonPath("$.perfumes[0].perfumeId").value(1));
    }

    /**
     * 내려간 향수는 순위에 오르지 않습니다. 올라오면 눌렀을 때 404 가 납니다.
     */
    @Test
    void excludesInactivePerfumes() throws Exception {
        long post = insertPost(1, "내려간 향수를 건 글", 1);
        mention(post, 4);
        mention(post, 1);

        mockMvc.perform(get(URL))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.perfumes.length()").value(1))
                .andExpect(jsonPath("$.perfumes[0].perfumeId").value(1));
    }

    /**
     * {@code limit} 으로 개수를 자르고, 범위를 벗어난 값은 잘립니다.
     */
    @Test
    void limitsHowManyComeBack() throws Exception {
        long post = insertPost(1, "셋 다 건 글", 1);
        mention(post, 1);
        mention(post, 2);
        mention(post, 3);

        mockMvc.perform(get(URL).param("limit", "2"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.perfumes.length()").value(2));

        mockMvc.perform(get(URL).param("limit", "0"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.perfumes.length()").value(1));
    }

    /**
     * 언급이 없으면 빈 배열입니다. {@code null} 이 아니어야 화면이 그대로 순회합니다.
     */
    @Test
    void returnsEmptyArrayWhenNothingWasMentioned() throws Exception {
        mockMvc.perform(get(URL))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.perfumes").isArray())
                .andExpect(jsonPath("$.perfumes.length()").value(0));
    }

    /**
     * <b>{@code /posts/{postId}} 와 경로가 겹치지 않아야 합니다.</b> 겹치면 Spring 이
     * "trending-perfumes" 를 글 번호로 읽어 400 이 납니다.
     */
    @Test
    void doesNotCollideWithThePostDetailRoute() throws Exception {
        mockMvc.perform(get(URL))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.days").exists());
    }

    /**
     * 로그인 없이 볼 수 있습니다. 게시판은 누구나 볼 수 있어야 합니다.
     *
     * <p>이 테스트는 {@code CurrentUser} 대역을 두지 않아 항상 비로그인 상태입니다. 다른 모든
     * 테스트가 통과하는 것 자체가 그 증거입니다.
     */
    @Test
    void doesNotRequireLogin() throws Exception {
        long post = insertPost(1, "비로그인으로 볼 글", 1);
        mention(post, 1);

        mockMvc.perform(get(URL))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.perfumes[0].perfumeId").value(1));
    }

    private void insertPerfume(long id, Long brandId, String name, boolean active) {
        jdbcTemplate.update("""
                INSERT INTO perfumes (perfume_id, brand_id, name, is_active)
                VALUES (?, ?, ?, ?)
                """, id, brandId, name, active);
    }

    /**
     * {@code daysAgo} 일 전에 쓰인 글을 심습니다. 기간 경계를 확인하려면 시각을 직접 정해야
     * 합니다.
     */
    private long insertPost(long id, String title, int daysAgo) {
        jdbcTemplate.update("""
                INSERT INTO posts (post_id, user_id, category_id, title, content, created_at, updated_at, view_count)
                VALUES (?, 1, (SELECT category_id FROM post_categories WHERE code = 'CHAT'),
                        ?, '본문입니다.', ?, ?, 0)
                """, id, title,
                OffsetDateTime.now().minusDays(daysAgo),
                OffsetDateTime.now().minusDays(daysAgo));
        return id;
    }

    private void mention(long postId, long perfumeId) {
        jdbcTemplate.update("""
                INSERT INTO post_perfumes (post_id, perfume_id, display_order)
                VALUES (?, ?, 0)
                """, postId, perfumeId);
    }

    private void clearData() {
        List.of(
                "DELETE FROM post_likes",
                "DELETE FROM comments",
                "DELETE FROM post_images",
                "DELETE FROM post_perfumes",
                "DELETE FROM posts",
                "DELETE FROM perfume_images",
                "DELETE FROM perfumes",
                "DELETE FROM brands",
                "DELETE FROM users"
        ).forEach(jdbcTemplate::update);
    }
}
