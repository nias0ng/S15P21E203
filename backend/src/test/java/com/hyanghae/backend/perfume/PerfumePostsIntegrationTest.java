package com.hyanghae.backend.perfume;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.hyanghae.backend.perfume.exception.PerfumeErrorCode;
import com.hyanghae.backend.support.IntegrationTest;
import java.time.OffsetDateTime;
import org.hamcrest.Matchers;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;

/**
 * 관련 게시글 조회를 실제 PostgreSQL 위에서 검증합니다.
 *
 * <p>향수 1 에 게시글 5건을 연결했습니다. 최신순 정렬은 작성 시각 내림차순이고, 시각이 같으면
 * 게시글 id 내림차순, 시각이 없으면 맨 뒤입니다. 따라서 기대 순서는 100, 101, 103, 102, 104 입니다.
 */
@IntegrationTest
@AutoConfigureMockMvc
class PerfumePostsIntegrationTest {

    private static final String POSTS_URL = "/api/v1/perfumes/{perfumeId}/posts";

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @BeforeEach
    void insertFixtures() {
        clearData();

        insertBrand(1, "Chanel");
        insertPerfume(1, "Base Scent", true);
        insertPerfume(2, "Other Scent", true);
        insertPerfume(3, "Retired Scent", false);
        insertPerfume(4, "Quiet Scent", true);

        insertPost(100, "가장 최신 글", "2026-09-08T10:00:00Z");
        insertPost(101, "중간 글", "2026-09-07T10:00:00Z");
        insertPost(102, "같은 시각 A", "2026-09-06T10:00:00Z");
        insertPost(103, "같은 시각 B", "2026-09-06T10:00:00Z");
        insertPost(104, "작성 시각 없는 글", null);
        insertPost(105, "다른 향수 글", "2026-09-09T10:00:00Z");

        linkPost(100, 1);
        linkPost(101, 1);
        linkPost(102, 1);
        linkPost(103, 1);
        linkPost(104, 1);
        linkPost(105, 2);
    }

    @AfterEach
    void cleanUp() {
        clearData();
    }

    @Test
    void returnsPostsOrderedByCreatedAtDesc() throws Exception {
        mockMvc.perform(get(POSTS_URL, 1))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.posts", Matchers.hasSize(5)))
                .andExpect(jsonPath("$.posts[0].postId").value(100))
                .andExpect(jsonPath("$.posts[0].title").value("가장 최신 글"))
                .andExpect(jsonPath("$.posts[0].createdAt").value("2026-09-08T10:00:00Z"))
                .andExpect(jsonPath("$.posts[1].postId").value(101));
    }

    /** 시각이 같으면 게시글 id 내림차순입니다. 순서가 흔들리면 페이지를 넘길 때 글이 겹칩니다. */
    @Test
    void breaksCreatedAtTieByPostIdDesc() throws Exception {
        mockMvc.perform(get(POSTS_URL, 1))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.posts[2].postId").value(103))
                .andExpect(jsonPath("$.posts[3].postId").value(102));
    }

    /** 작성 시각이 없는 글은 맨 뒤입니다. posts.created_at 에 NOT NULL 제약이 없습니다. */
    @Test
    void putsPostWithoutCreatedAtLast() throws Exception {
        mockMvc.perform(get(POSTS_URL, 1))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.posts[4].postId").value(104))
                .andExpect(jsonPath("$.posts[4].createdAt").doesNotExist());
    }

    @Test
    void returnsPagingFields() throws Exception {
        mockMvc.perform(get(POSTS_URL, 1))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.page").value(0))
                .andExpect(jsonPath("$.size").value(20))
                .andExpect(jsonPath("$.totalElements").value(5));
    }

    /** totalElements 는 이 페이지가 아니라 전체 개수입니다. */
    @Test
    void returnsRequestedPage() throws Exception {
        mockMvc.perform(get(POSTS_URL, 1).param("page", "1").param("size", "2"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.posts", Matchers.hasSize(2)))
                .andExpect(jsonPath("$.posts[0].postId").value(103))
                .andExpect(jsonPath("$.posts[1].postId").value(102))
                .andExpect(jsonPath("$.page").value(1))
                .andExpect(jsonPath("$.totalElements").value(5));
    }

    @Test
    void returnsEmptyPageBeyondLastPage() throws Exception {
        mockMvc.perform(get(POSTS_URL, 1).param("page", "9").param("size", "2"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.posts", Matchers.hasSize(0)))
                .andExpect(jsonPath("$.totalElements").value(5));
    }

    /** 다른 향수에 걸린 글은 섞이지 않습니다. */
    @Test
    void excludesPostsLinkedToOtherPerfumes() throws Exception {
        mockMvc.perform(get(POSTS_URL, 2))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.posts", Matchers.hasSize(1)))
                .andExpect(jsonPath("$.posts[0].postId").value(105));
    }

    @Test
    void returnsEmptyListWhenPerfumeHasNoPost() throws Exception {
        mockMvc.perform(get(POSTS_URL, 4))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.posts", Matchers.hasSize(0)))
                .andExpect(jsonPath("$.totalElements").value(0));
    }

    /** 음수 페이지는 OFFSET 을 음수로 만들어 SQL 오류가 됩니다. 500 이 나면 안 됩니다. */
    @Test
    void clampsNegativePageInsteadOfFailing() throws Exception {
        mockMvc.perform(get(POSTS_URL, 1).param("page", "-1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.page").value(0))
                .andExpect(jsonPath("$.posts", Matchers.hasSize(5)));
    }

    @Test
    void clampsSizeBelowOneInsteadOfFailing() throws Exception {
        mockMvc.perform(get(POSTS_URL, 1).param("size", "0"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.size").value(1))
                .andExpect(jsonPath("$.posts", Matchers.hasSize(1)));
    }

    @Test
    void capsOversizedRequestInsteadOfFailing() throws Exception {
        mockMvc.perform(get(POSTS_URL, 1).param("size", "100000"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.size").value(100))
                .andExpect(jsonPath("$.posts", Matchers.hasSize(5)));
    }

    @Test
    void returnsNotFoundWhenPerfumeDoesNotExist() throws Exception {
        mockMvc.perform(get(POSTS_URL, 999))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value(PerfumeErrorCode.PERFUME_NOT_FOUND.code()));
    }

    @Test
    void returnsNotFoundForInactivePerfume() throws Exception {
        mockMvc.perform(get(POSTS_URL, 3))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value(PerfumeErrorCode.PERFUME_NOT_FOUND.code()));
    }

    private void insertBrand(long id, String name) {
        jdbcTemplate.update(
                "INSERT INTO brands (brand_id, name, is_active) VALUES (?, ?, true)", id, name);
    }

    private void insertPerfume(long id, String name, boolean active) {
        jdbcTemplate.update(
                "INSERT INTO perfumes (perfume_id, brand_id, name, is_active) VALUES (?, 1, ?, ?)",
                id, name, active);
    }

    /** 작성자와 분류는 비워 둡니다. 두 컬럼 모두 NULL 을 허용하고 이 기능과 무관합니다. */
    private void insertPost(long id, String title, String createdAt) {
        jdbcTemplate.update(
                "INSERT INTO posts (post_id, title, created_at) VALUES (?, ?, ?)",
                id, title, createdAt == null ? null : OffsetDateTime.parse(createdAt));
    }

    private void linkPost(long postId, long perfumeId) {
        jdbcTemplate.update(
                "INSERT INTO post_perfumes (post_id, perfume_id) VALUES (?, ?)", postId, perfumeId);
    }

    private void clearData() {
        jdbcTemplate.update("DELETE FROM post_perfumes");
        jdbcTemplate.update("DELETE FROM posts");
        jdbcTemplate.update("DELETE FROM perfumes");
        jdbcTemplate.update("DELETE FROM brands");
    }
}
