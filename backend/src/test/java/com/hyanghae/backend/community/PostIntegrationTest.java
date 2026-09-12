package com.hyanghae.backend.community;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.hyanghae.backend.community.exception.CommunityErrorCode;
import com.hyanghae.backend.global.security.CurrentUser;
import com.hyanghae.backend.support.IntegrationTest;
import java.util.List;
import java.util.Optional;
import org.hamcrest.Matchers;
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
import org.springframework.test.web.servlet.ResultActions;

/**
 * 자유 게시판 글의 CRUD 를 실제 PostgreSQL 위에서 검증합니다.
 *
 * <p>인증이 아직 없어 {@link CurrentUser} 를 대역으로 바꿔 로그인한 경우를 만듭니다.
 *
 * <p>분류 셋은 마이그레이션이 심어 둔 것을 그대로 씁니다. 번호가 아니라 코드로 주고받으므로
 * 테스트도 코드만 씁니다.
 */
@IntegrationTest
@AutoConfigureMockMvc
class PostIntegrationTest {

    private static final String POSTS_URL = "/api/v1/posts";
    private static final String POST_URL = "/api/v1/posts/{postId}";

    private static final long WRITER_ID = 1;
    private static final long OTHER_WRITER_ID = 2;

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private FakeCurrentUser currentUser;

    @BeforeEach
    void insertFixtures() {
        clearData();

        insertUser(WRITER_ID, "writer@hyanghae.test", "글쓴이");
        insertUser(OTHER_WRITER_ID, "other@hyanghae.test", "다른 사람");

        insertBrand(1, "Chanel");
        insertPerfume(1, "Base Scent", true);
        insertPerfume(2, "Second Scent", true);
        insertPerfume(3, "Retired Scent", false);

        currentUser.login(WRITER_ID);
    }

    @AfterEach
    void cleanUp() {
        currentUser.logout();
        clearData();
    }

    /**
     * 글을 쓰면 향수와 이미지가 보낸 순서대로 걸립니다.
     *
     * <p>순서를 지키지 않으면 화면이 고른 대표 이미지가 매번 달라집니다.
     */
    @Test
    void writesPostWithPerfumesAndImagesInOrder() throws Exception {
        long postId = write("CHAT", "첫 글", "본문입니다.",
                List.of(2L, 1L), List.of("second.jpg", "first.jpg"));

        mockMvc.perform(get(POST_URL, postId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.title").value("첫 글"))
                .andExpect(jsonPath("$.content").value("본문입니다."))
                .andExpect(jsonPath("$.nickname").value("글쓴이"))
                .andExpect(jsonPath("$.category").value("CHAT"))
                .andExpect(jsonPath("$.imageUrls")
                        .value(Matchers.contains("second.jpg", "first.jpg")))
                .andExpect(jsonPath("$.relatedPerfumes[*].perfumeId")
                        .value(Matchers.contains(2, 1)))
                .andExpect(jsonPath("$.relatedPerfumes[0].name").value("Second Scent"))
                .andExpect(jsonPath("$.relatedPerfumes[0].brand").value("Chanel"))
                .andExpect(jsonPath("$.createdAt").isNotEmpty())
                .andExpect(jsonPath("$.updatedAt").isNotEmpty());
    }

    /** 향수도 이미지도 없는 글을 쓸 수 있습니다. 자유 게시판 글은 향수를 걸지 않을 수 있습니다. */
    @Test
    void writesPostWithoutPerfumesOrImages() throws Exception {
        long postId = write("CHAT", "혼잣말", "향수 없이 씁니다.", null, null);

        mockMvc.perform(get(POST_URL, postId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.imageUrls").isEmpty())
                .andExpect(jsonPath("$.relatedPerfumes").isEmpty());
    }

    /**
     * 목록은 최신순이고 분류로 거를 수 있습니다.
     *
     * <p>분류를 주지 않으면 전체입니다. 총 개수는 거른 범위와 같은 기준으로 셉니다.
     */
    @Test
    void listsPostsByCategoryInLatestOrder() throws Exception {
        write("CHAT", "첫 번째", "본문", null, null);
        write("RECOMMEND", "두 번째", "본문", null, null);
        write("CHAT", "세 번째", "본문", null, null);

        mockMvc.perform(get(POSTS_URL))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(3))
                .andExpect(jsonPath("$.page").value(0))
                .andExpect(jsonPath("$.size").value(20))
                .andExpect(jsonPath("$.posts[*].title")
                        .value(Matchers.contains("세 번째", "두 번째", "첫 번째")))
                .andExpect(jsonPath("$.posts[0].nickname").value("글쓴이"));

        mockMvc.perform(get(POSTS_URL).param("category", "CHAT"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(2))
                .andExpect(jsonPath("$.posts[*].title")
                        .value(Matchers.contains("세 번째", "첫 번째")));
    }

    /**
     * 목록 한 줄에 분류 코드와 대표 향수가 실립니다.
     *
     * <p>대표는 <b>먼저 걸어 둔 향수</b>입니다. 화면이 매번 하나를 고르지 않도록 서버가 정합니다.
     * 향수를 걸지 않은 글은 비어 있습니다.
     */
    @Test
    void putsCategoryAndRepresentativePerfumeInEachRow() throws Exception {
        write("COLLECTION", "향수 건 글", "본문", List.of(2L, 1L), null);
        write("CHAT", "향수 없는 글", "본문", null, null);

        mockMvc.perform(get(POSTS_URL))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.posts[0].category").value("CHAT"))
                .andExpect(jsonPath("$.posts[0].perfume").doesNotExist())
                .andExpect(jsonPath("$.posts[1].category").value("COLLECTION"))
                .andExpect(jsonPath("$.posts[1].perfume.perfumeId").value(2))
                .andExpect(jsonPath("$.posts[1].perfume.name").value("Second Scent"))
                .andExpect(jsonPath("$.posts[1].perfume.brand").value("Chanel"));
    }

    /** 페이지 크기는 1~100 으로 자릅니다. 총 개수는 자른 것과 무관하게 전체입니다. */
    @Test
    void clampsPageSize() throws Exception {
        write("CHAT", "하나", "본문", null, null);
        write("CHAT", "둘", "본문", null, null);

        mockMvc.perform(get(POSTS_URL).param("size", "1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.posts.length()").value(1))
                .andExpect(jsonPath("$.totalElements").value(2));

        mockMvc.perform(get(POSTS_URL).param("size", "500"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.size").value(100));
    }

    /**
     * 보낸 항목만 바뀌고 나머지는 그대로입니다.
     *
     * <p>제목만 보내면 내용과 분류, 향수 연결이 그대로 남아야 합니다. 부분 수정이 아니면 화면이
     * 매번 글 전체를 다시 보내야 합니다.
     */
    @Test
    void updatesOnlyWhatWasSent() throws Exception {
        long postId = write("CHAT", "원래 제목", "원래 본문",
                List.of(1L), List.of("first.jpg"));

        mockMvc.perform(patch(POST_URL, postId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"title\": \"고친 제목\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.postId").value(postId))
                .andExpect(jsonPath("$.updatedAt").isNotEmpty());

        mockMvc.perform(get(POST_URL, postId))
                .andExpect(jsonPath("$.title").value("고친 제목"))
                .andExpect(jsonPath("$.content").value("원래 본문"))
                .andExpect(jsonPath("$.category").value("CHAT"))
                .andExpect(jsonPath("$.relatedPerfumes[*].perfumeId")
                        .value(Matchers.contains(1)))
                .andExpect(jsonPath("$.imageUrls").value(Matchers.contains("first.jpg")));
    }

    /** 분류를 코드로 바꿀 수 있습니다. */
    @Test
    void changesCategoryByCode() throws Exception {
        long postId = write("CHAT", "제목", "본문", null, null);

        mockMvc.perform(patch(POST_URL, postId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"category\": \"RECOMMEND\"}"))
                .andExpect(status().isOk());

        mockMvc.perform(get(POST_URL, postId))
                .andExpect(jsonPath("$.category").value("RECOMMEND"));
    }

    /** 빈 배열을 보내면 연결이 모두 지워집니다. 목록을 통째로 바꾸는 방식이라 가능한 동작입니다. */
    @Test
    void clearsLinksWithEmptyArrays() throws Exception {
        long postId = write("CHAT", "제목", "본문", List.of(1L, 2L), List.of("a.jpg"));

        mockMvc.perform(patch(POST_URL, postId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"perfumeIds\": [], \"imageUrls\": []}"))
                .andExpect(status().isOk());

        mockMvc.perform(get(POST_URL, postId))
                .andExpect(jsonPath("$.relatedPerfumes").isEmpty())
                .andExpect(jsonPath("$.imageUrls").isEmpty());
    }

    /** 고칠 항목이 없거나 분류·제목·내용을 비우라고 보내면 400 입니다. */
    @Test
    void rejectsEmptyPatch() throws Exception {
        long postId = write("CHAT", "제목", "본문", null, null);

        for (String body : new String[]{"{}", "{\"title\": \"\"}", "{\"content\": null}",
                "{\"category\": \"\"}"}) {
            mockMvc.perform(patch(POST_URL, postId)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(body))
                    .andExpect(status().isBadRequest());
        }
    }

    /** 글을 지우면 이미지와 향수 연결도 함께 사라집니다. 외래키가 지웁니다. */
    @Test
    void deletesPostWithItsLinks() throws Exception {
        long postId = write("CHAT", "지울 글", "본문", List.of(1L), List.of("a.jpg"));

        mockMvc.perform(delete(POST_URL, postId))
                .andExpect(status().isNoContent());

        mockMvc.perform(get(POST_URL, postId))
                .andExpect(status().isNotFound());
        assertThat(countRows("post_images")).isZero();
        assertThat(countRows("post_perfumes")).isZero();
    }

    /**
     * {@code mine} 은 보는 사람마다 다릅니다.
     *
     * <p>화면이 수정·삭제 버튼을 띄울지 정하는 값입니다. 비로그인도 상세를 볼 수 있어야 하므로
     * 로그인하지 않았다고 401 을 내지 않고 거짓으로 답합니다.
     */
    @Test
    void tellsWhetherThePostIsMine() throws Exception {
        long postId = write("CHAT", "내 글", "본문", null, null);

        mockMvc.perform(get(POST_URL, postId))
                .andExpect(jsonPath("$.mine").value(true));

        currentUser.login(OTHER_WRITER_ID);
        mockMvc.perform(get(POST_URL, postId))
                .andExpect(jsonPath("$.mine").value(false));

        currentUser.logout();
        mockMvc.perform(get(POST_URL, postId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.mine").value(false));
    }

    /**
     * 남의 글은 고치거나 지울 수 없습니다. 403 입니다.
     *
     * <p>404 로 답하지 않는 이유는 게시글이 누구나 볼 수 있는 글이기 때문입니다. 존재를 숨길 이유가
     * 없고, 404 면 화면이 "지워졌나" 와 "내 글이 아닌가" 를 구분하지 못합니다.
     */
    @Test
    void rejectsEditingSomeoneElsesPost() throws Exception {
        long postId = write("CHAT", "남의 글", "본문", null, null);
        currentUser.login(OTHER_WRITER_ID);

        mockMvc.perform(patch(POST_URL, postId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"title\": \"가로채기\"}"))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code")
                        .value(CommunityErrorCode.COMMUNITY_POST_NOT_OWNED.code()));

        mockMvc.perform(delete(POST_URL, postId))
                .andExpect(status().isForbidden());

        mockMvc.perform(get(POST_URL, postId)).andExpect(status().isOk());
    }

    /** 없는 글은 404 입니다. 읽기도 고치기도 같습니다. */
    @Test
    void returnsNotFoundForMissingPost() throws Exception {
        mockMvc.perform(get(POST_URL, 999))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code")
                        .value(CommunityErrorCode.COMMUNITY_POST_NOT_FOUND.code()));

        mockMvc.perform(delete(POST_URL, 999))
                .andExpect(status().isNotFound());
    }

    /** 없거나 내려간 분류·향수로는 글을 쓸 수 없습니다. 404 입니다. */
    @Test
    void rejectsUnknownCategoryOrPerfume() throws Exception {
        mockMvc.perform(post(POSTS_URL)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(createBody("REVIEW", "제목", "본문", null, null)))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code")
                        .value(CommunityErrorCode.COMMUNITY_CATEGORY_NOT_FOUND.code()));

        mockMvc.perform(post(POSTS_URL)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(createBody("CHAT", "제목", "본문", List.of(3L), null)))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code")
                        .value(CommunityErrorCode.COMMUNITY_PERFUME_NOT_FOUND.code()));

        assertThat(countRows("posts")).isZero();
    }

    /** 같은 향수를 두 번 걸면 400 입니다. 화면이 목록을 잘못 만들고 있다는 뜻입니다. */
    @Test
    void rejectsDuplicatePerfumes() throws Exception {
        mockMvc.perform(post(POSTS_URL)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(createBody("CHAT", "제목", "본문", List.of(1L, 1L), null)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code")
                        .value(CommunityErrorCode.COMMUNITY_POST_INVALID.code()));
    }

    /** 제목이 50자를 넘거나 제목·내용·분류가 비면 400 입니다. 제목 길이는 컬럼 제한과 같습니다. */
    @Test
    void rejectsInvalidTitleOrContent() throws Exception {
        String tooLong = "가".repeat(51);

        for (String body : new String[]{
                createBody("CHAT", tooLong, "본문", null, null),
                createBody("CHAT", "  ", "본문", null, null),
                createBody("CHAT", "제목", "", null, null),
                createBody("  ", "제목", "본문", null, null),
        }) {
            mockMvc.perform(post(POSTS_URL)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(body))
                    .andExpect(status().isBadRequest());
        }

        assertThat(countRows("posts")).isZero();
    }

    /**
     * 읽기는 로그인 없이도 되고 쓰기는 401 입니다.
     *
     * <p>게시판은 누구나 볼 수 있어야 하고, 글은 쓴 사람에게 매달리는 값입니다.
     */
    @Test
    void allowsReadingWithoutLoginButNotWriting() throws Exception {
        long postId = write("CHAT", "공개 글", "본문", null, null);
        currentUser.logout();

        mockMvc.perform(get(POSTS_URL)).andExpect(status().isOk());
        mockMvc.perform(get(POST_URL, postId)).andExpect(status().isOk());

        mockMvc.perform(post(POSTS_URL)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(createBody("CHAT", "제목", "본문", null, null)))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code")
                        .value(CommunityErrorCode.COMMUNITY_LOGIN_REQUIRED.code()));

        mockMvc.perform(patch(POST_URL, postId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"title\": \"고침\"}"))
                .andExpect(status().isUnauthorized());

        mockMvc.perform(delete(POST_URL, postId))
                .andExpect(status().isUnauthorized());
    }

    /**
     * 작성자가 탈퇴해도 글은 남고 닉네임만 비어 나갑니다.
     *
     * <p>{@code posts.user_id} 가 {@code ON DELETE SET NULL} 이라 글이 함께 지워지지 않습니다.
     * 대신 주인이 없어져 아무도 고칠 수 없습니다.
     */
    @Test
    void keepsPostAfterTheWriterLeaves() throws Exception {
        long postId = write("CHAT", "남는 글", "본문", null, null);

        jdbcTemplate.update("DELETE FROM users WHERE user_id = ?", WRITER_ID);

        mockMvc.perform(get(POST_URL, postId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.title").value("남는 글"))
                .andExpect(jsonPath("$.nickname").doesNotExist())
                .andExpect(jsonPath("$.mine").value(false));

        currentUser.login(OTHER_WRITER_ID);
        mockMvc.perform(delete(POST_URL, postId))
                .andExpect(status().isForbidden());
    }

    private long write(
            String category,
            String title,
            String content,
            List<Long> perfumeIds,
            List<String> imageUrls
    ) throws Exception {
        ResultActions created = mockMvc.perform(post(POSTS_URL)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(createBody(category, title, content, perfumeIds, imageUrls)))
                .andExpect(status().isCreated());

        JsonNode body = objectMapper.readTree(
                created.andReturn().getResponse().getContentAsString());
        return body.get("postId").asLong();
    }

    private String createBody(
            String category,
            String title,
            String content,
            List<Long> perfumeIds,
            List<String> imageUrls
    ) throws Exception {
        StringBuilder json = new StringBuilder("{\"category\": ")
                .append(objectMapper.writeValueAsString(category))
                .append(", \"title\": ").append(objectMapper.writeValueAsString(title))
                .append(", \"content\": ").append(objectMapper.writeValueAsString(content));
        if (perfumeIds != null) {
            json.append(", \"perfumeIds\": ").append(objectMapper.writeValueAsString(perfumeIds));
        }
        if (imageUrls != null) {
            json.append(", \"imageUrls\": ").append(objectMapper.writeValueAsString(imageUrls));
        }
        return json.append("}").toString();
    }

    private int countRows(String table) {
        return jdbcTemplate.queryForObject("SELECT COUNT(*) FROM " + table, Integer.class);
    }

    private void insertUser(long id, String email, String nickname) {
        jdbcTemplate.update(
                "INSERT INTO users (user_id, email, password_hash, nickname) VALUES (?, ?, 'x', ?)",
                id, email, nickname);
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

    /**
     * 테스트가 넣은 것만 지웁니다.
     *
     * <p>{@code post_categories} 는 마이그레이션이 심은 분류 셋이라 건드리지 않습니다.
     */
    private void clearData() {
        jdbcTemplate.update("DELETE FROM post_images");
        jdbcTemplate.update("DELETE FROM post_perfumes");
        jdbcTemplate.update("DELETE FROM posts");
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
