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
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

/**
 * 댓글을 실제 PostgreSQL 위에서 검증합니다.
 *
 * <p>댓글은 자유 게시판 글과 후기 두 곳에 달립니다. 부모를 둘 다 심어 두고 양쪽을 확인합니다.
 * <b>글 1번과 후기 1번의 번호가 같으므로</b>, 두 목록이 서로 섞이지 않는지 보기에 좋습니다.
 *
 * <p>부모는 API 가 아니라 SQL 로 직접 넣습니다. 게시글·후기 API 가 바뀌어도 댓글 테스트가
 * 흔들리지 않아야 합니다.
 */
@IntegrationTest
@AutoConfigureMockMvc
@ActiveProfiles({"manual-test", "test"})
class CommentIntegrationTest {

    private static final String POST_COMMENTS_URL = "/api/v1/posts/{postId}/comments";
    private static final String REVIEW_COMMENTS_URL = "/api/v1/reviews/{reviewId}/comments";
    private static final String COMMENT_URL = "/api/v1/comments/{commentId}";

    private static final long WRITER_ID = 1;
    private static final long OTHER_WRITER_ID = 2;

    private static final long POST_ID = 1;
    private static final long REVIEW_ID = 1;
    private static final long MISSING_ID = 999;

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

        jdbcTemplate.update(
                "INSERT INTO brands (brand_id, name, is_active) VALUES (1, 'Chanel', TRUE)");
        jdbcTemplate.update("""
                INSERT INTO perfumes (perfume_id, brand_id, name, is_active)
                VALUES (1, 1, 'Base Scent', TRUE)
                """);

        // 자유 게시판 글 하나. 분류는 마이그레이션이 심어 둔 것을 코드로 찾습니다.
        jdbcTemplate.update("""
                INSERT INTO posts (post_id, user_id, category_id, title, content,
                                   created_at, updated_at)
                VALUES (?, ?, (SELECT category_id FROM post_categories WHERE code = 'CHAT'),
                        '글 제목', '글 본문', NOW(), NOW())
                """, POST_ID, WRITER_ID);

        // 후기 하나. 한 사용자는 한 향수에 후기를 하나만 가질 수 있습니다(V5 유니크 제약).
        jdbcTemplate.update("""
                INSERT INTO perfume_reviews (id, user_id, perfume_id, title, content,
                                             created_at, updated_at)
                VALUES (?, ?, 1, '후기 제목', '후기 내용입니다.', NOW(), NOW())
                """, REVIEW_ID, WRITER_ID);

        currentUser.login(WRITER_ID);
    }

    @AfterEach
    void cleanUp() {
        currentUser.logout();
        clearData();
    }

    // ────────────────────────────────────────────────────────────────
    // 작성과 목록
    // ────────────────────────────────────────────────────────────────

    /**
     * 글에 댓글을 쓰면 목록에 나옵니다.
     *
     * <p>가장 단순한 성공 경로입니다. 이게 통과하면 픽스처와 설정이 맞다는 뜻입니다.
     */
    @Test
    void writesCommentOnPostAndListsIt() throws Exception {
        long commentId = writeOnPost("첫 댓글입니다.");

        mockMvc.perform(get(POST_COMMENTS_URL, POST_ID))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(1))
                .andExpect(jsonPath("$.page").value(0))
                .andExpect(jsonPath("$.size").value(20))
                .andExpect(jsonPath("$.comments[0].commentId").value(commentId))
                .andExpect(jsonPath("$.comments[0].content").value("첫 댓글입니다."))
                .andExpect(jsonPath("$.comments[0].nickname").value("글쓴이"))
                .andExpect(jsonPath("$.comments[0].mine").value(true))
                .andExpect(jsonPath("$.comments[0].createdAt").isNotEmpty())
                .andExpect(jsonPath("$.comments[0].updatedAt").isNotEmpty());
    }

    /** 후기에도 같은 방식으로 댓글이 달립니다. 응답 모양은 글 쪽과 같습니다. */
    @Test
    void writesCommentOnReviewAndListsIt() throws Exception {
        long commentId = writeOnReview("후기에 단 댓글입니다.");

        mockMvc.perform(get(REVIEW_COMMENTS_URL, REVIEW_ID))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(1))
                .andExpect(jsonPath("$.page").value(0))
                .andExpect(jsonPath("$.size").value(20))
                .andExpect(jsonPath("$.comments[0].commentId").value(commentId))
                .andExpect(jsonPath("$.comments[0].content").value("후기에 단 댓글입니다."))
                .andExpect(jsonPath("$.comments[0].nickname").value("글쓴이"))
                .andExpect(jsonPath("$.comments[0].mine").value(true))
                .andExpect(jsonPath("$.comments[0].createdAt").isNotEmpty())
                .andExpect(jsonPath("$.comments[0].updatedAt").isNotEmpty());
    }

    /**
     * 글의 댓글과 후기의 댓글은 서로의 목록에 나오지 않습니다.
     *
     * <p>글도 1번이고 후기도 1번입니다. 조회 SQL 이 부모 종류를 보지 않고 번호만 본다면 두 목록에
     * 남의 댓글이 섞여 나옵니다. 번호를 일부러 같게 맞춘 이유입니다.
     */
    @Test
    void keepsPostCommentsAndReviewCommentsApart() throws Exception {
        writeOnPost("글에 단 댓글");
        writeOnReview("후기에 단 댓글");

        mockMvc.perform(get(POST_COMMENTS_URL, POST_ID))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(1))
                .andExpect(jsonPath("$.comments[*].content")
                        .value(Matchers.contains("글에 단 댓글")));

        mockMvc.perform(get(REVIEW_COMMENTS_URL, REVIEW_ID))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(1))
                .andExpect(jsonPath("$.comments[*].content")
                        .value(Matchers.contains("후기에 단 댓글")));

        assertThat(countRows("comments")).isEqualTo(2);
    }

    /**
     * 목록은 <b>오래된 순</b>입니다.
     *
     * <p>댓글은 대화라서 위에서 아래로 읽힙니다. 최신순이면 답이 질문보다 위에 옵니다.
     */
    @Test
    void listsCommentsFromOldestToNewest() throws Exception {
        writeOnPost("첫째");
        writeOnPost("둘째");
        writeOnPost("셋째");

        mockMvc.perform(get(POST_COMMENTS_URL, POST_ID))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.comments[*].content")
                        .value(Matchers.contains("첫째", "둘째", "셋째")));
    }

    /** 페이지 크기는 1~100 으로 자릅니다. 총 개수는 자른 것과 무관하게 전체입니다. */
    @Test
    void clampsPageSize() throws Exception {
        writeOnPost("첫째");
        writeOnPost("둘째");

        mockMvc.perform(get(POST_COMMENTS_URL, POST_ID).param("size", "1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.comments.length()").value(1))
                .andExpect(jsonPath("$.comments[0].content").value("첫째"))
                .andExpect(jsonPath("$.totalElements").value(2));

        mockMvc.perform(get(POST_COMMENTS_URL, POST_ID).param("size", "500"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.size").value(100));
    }

    /**
     * 없는 부모에는 댓글을 달 수도, 목록을 볼 수도 없습니다.
     *
     * <p>글과 후기의 에러 코드가 다릅니다. 화면이 "글이 지워졌다" 와 "후기가 지워졌다" 를 구분해
     * 안내할 수 있어야 합니다.
     */
    @Test
    void rejectsMissingParent() throws Exception {
        mockMvc.perform(post(POST_COMMENTS_URL, MISSING_ID)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(commentBody("없는 글에 답니다.")))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code")
                        .value(CommunityErrorCode.COMMUNITY_POST_NOT_FOUND.code()));

        mockMvc.perform(post(REVIEW_COMMENTS_URL, MISSING_ID)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(commentBody("없는 후기에 답니다.")))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code")
                        .value(CommunityErrorCode.COMMUNITY_REVIEW_NOT_FOUND.code()));

        mockMvc.perform(get(POST_COMMENTS_URL, MISSING_ID))
                .andExpect(status().isNotFound());
        mockMvc.perform(get(REVIEW_COMMENTS_URL, MISSING_ID))
                .andExpect(status().isNotFound());

        assertThat(countRows("comments")).isZero();
    }

    /** 내용이 비었거나 500자를 넘으면 400 입니다. 검증 애노테이션이 서비스보다 먼저 막습니다. */
    @Test
    void rejectsInvalidContent() throws Exception {
        for (String body : new String[]{
                commentBody(""),
                commentBody("   "),
                commentBody("가".repeat(501)),
                "{}",
        }) {
            mockMvc.perform(post(POST_COMMENTS_URL, POST_ID)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(body))
                    .andExpect(status().isBadRequest());
        }

        assertThat(countRows("comments")).isZero();
    }

    /** 500자는 됩니다. 경계값이 제한에 걸리면 안 됩니다. */
    @Test
    void acceptsContentAtTheLengthLimit() throws Exception {
        writeOnPost("가".repeat(500));

        assertThat(countRows("comments")).isEqualTo(1);
    }

    // ────────────────────────────────────────────────────────────────
    // mine 과 로그인
    // ────────────────────────────────────────────────────────────────

    /**
     * {@code mine} 은 보는 사람마다 다릅니다.
     *
     * <p>화면이 수정·삭제 버튼을 띄울지 정하는 값입니다. 목록은 비로그인도 볼 수 있어야 하므로
     * 로그인하지 않았다고 401 을 내지 않고 거짓으로 답합니다.
     */
    @Test
    void tellsWhetherTheCommentIsMine() throws Exception {
        writeOnPost("내 댓글");

        mockMvc.perform(get(POST_COMMENTS_URL, POST_ID))
                .andExpect(jsonPath("$.comments[0].mine").value(true));

        currentUser.login(OTHER_WRITER_ID);
        mockMvc.perform(get(POST_COMMENTS_URL, POST_ID))
                .andExpect(jsonPath("$.comments[0].mine").value(false));

        currentUser.logout();
        mockMvc.perform(get(POST_COMMENTS_URL, POST_ID))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.comments[0].mine").value(false));
    }

    /** 읽기는 로그인 없이도 되고 쓰기 셋은 401 입니다. */
    @Test
    void allowsReadingWithoutLoginButNotWriting() throws Exception {
        long commentId = writeOnPost("공개 댓글");
        currentUser.logout();

        mockMvc.perform(get(POST_COMMENTS_URL, POST_ID)).andExpect(status().isOk());
        mockMvc.perform(get(REVIEW_COMMENTS_URL, REVIEW_ID)).andExpect(status().isOk());

        mockMvc.perform(post(POST_COMMENTS_URL, POST_ID)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(commentBody("비로그인 작성")))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code")
                        .value(CommunityErrorCode.COMMUNITY_LOGIN_REQUIRED.code()));

        mockMvc.perform(patch(COMMENT_URL, commentId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(commentBody("비로그인 수정")))
                .andExpect(status().isUnauthorized());

        mockMvc.perform(delete(COMMENT_URL, commentId))
                .andExpect(status().isUnauthorized());
    }

    // ────────────────────────────────────────────────────────────────
    // 수정과 삭제
    // ────────────────────────────────────────────────────────────────

    /**
     * 내용을 고치면 {@code updatedAt} 이 갱신됩니다.
     *
     * <p>화면은 {@code createdAt} 과 {@code updatedAt} 이 다른 것으로 "(수정됨)" 을 판단합니다.
     * 작성 시각을 1분 전으로 되돌려 두 값이 반드시 갈리게 만듭니다. 쓰자마자 고치면 시각이 같을
     * 수도 있어 검증이 흔들립니다.
     */
    @Test
    void updatesContentAndBumpsUpdatedAt() throws Exception {
        long commentId = writeOnPost("고치기 전");
        agePastComment(commentId);

        mockMvc.perform(patch(COMMENT_URL, commentId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(commentBody("고친 뒤")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.commentId").value(commentId))
                .andExpect(jsonPath("$.updatedAt").isNotEmpty());

        mockMvc.perform(get(POST_COMMENTS_URL, POST_ID))
                .andExpect(jsonPath("$.comments[0].content").value("고친 뒤"));

        assertThat(jdbcTemplate.queryForObject(
                "SELECT updated_at > created_at FROM comments WHERE comment_id = ?",
                Boolean.class, commentId))
                .isTrue();
    }

    /**
     * 남의 댓글은 고치거나 지울 수 없습니다. 403 입니다.
     *
     * <p>404 로 답하지 않는 이유는 댓글이 누구나 볼 수 있는 자료이기 때문입니다. 존재를 숨길 이유가
     * 없고, 404 면 화면이 "지워졌나" 와 "내 것이 아닌가" 를 구분하지 못합니다.
     */
    @Test
    void rejectsEditingSomeoneElsesComment() throws Exception {
        long commentId = writeOnPost("남의 댓글");
        currentUser.login(OTHER_WRITER_ID);

        mockMvc.perform(patch(COMMENT_URL, commentId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(commentBody("가로채기")))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code")
                        .value(CommunityErrorCode.COMMUNITY_COMMENT_NOT_OWNED.code()));

        mockMvc.perform(delete(COMMENT_URL, commentId))
                .andExpect(status().isForbidden());

        mockMvc.perform(get(POST_COMMENTS_URL, POST_ID))
                .andExpect(jsonPath("$.comments[0].content").value("남의 댓글"));
    }

    /** 없는 댓글은 404 입니다. 고치기도 지우기도 같습니다. */
    @Test
    void returnsNotFoundForMissingComment() throws Exception {
        mockMvc.perform(patch(COMMENT_URL, MISSING_ID)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(commentBody("없는 댓글")))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code")
                        .value(CommunityErrorCode.COMMUNITY_COMMENT_NOT_FOUND.code()));

        mockMvc.perform(delete(COMMENT_URL, MISSING_ID))
                .andExpect(status().isNotFound());
    }

    /**
     * 지운 댓글은 <b>행째로 사라집니다.</b>
     *
     * <p>서재(V4)와 후기·게시글의 보류 상태(V5)에서 걷어낸 것과 같은 기준입니다. 목록에서만
     * 빠지고 행이 남는다면 조회하는 쪽이 매번 살아 있는 행을 걸러야 하고, 한 곳이라도 빠뜨리면
     * 지운 댓글이 화면에 다시 나옵니다.
     */
    @Test
    void deletesComment() throws Exception {
        long commentId = writeOnPost("지울 댓글");

        mockMvc.perform(delete(COMMENT_URL, commentId))
                .andExpect(status().isNoContent());

        mockMvc.perform(get(POST_COMMENTS_URL, POST_ID))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(0))
                .andExpect(jsonPath("$.comments").isEmpty());

        assertThat(countRows("comments")).isZero();
        assertThat(commentId).isPositive();
    }

    /** 이미 지운 댓글은 다시 지울 수도, 고칠 수도 없습니다. 404 입니다. */
    @Test
    void treatsDeletedCommentAsMissing() throws Exception {
        long commentId = writeOnPost("지울 댓글");
        mockMvc.perform(delete(COMMENT_URL, commentId)).andExpect(status().isNoContent());

        mockMvc.perform(delete(COMMENT_URL, commentId))
                .andExpect(status().isNotFound());

        mockMvc.perform(patch(COMMENT_URL, commentId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(commentBody("되살리기")))
                .andExpect(status().isNotFound());
    }

    // ────────────────────────────────────────────────────────────────
    // 부모와 작성자가 사라질 때
    // ────────────────────────────────────────────────────────────────

    /**
     * 부모를 지우면 댓글도 함께 사라집니다.
     *
     * <p>외래키가 지웁니다. 글 쪽은 처음부터 그랬고 후기 쪽은 V12 가 건 제약입니다. 이번
     * 마이그레이션이 실제로 동작하는지 확인하는 자리입니다.
     */
    @Test
    void deletesCommentsWhenTheParentGoesAway() throws Exception {
        writeOnPost("글의 댓글");
        writeOnReview("후기의 댓글");
        assertThat(countRows("comments")).isEqualTo(2);

        jdbcTemplate.update("DELETE FROM posts WHERE post_id = ?", POST_ID);
        assertThat(countRows("comments")).isEqualTo(1);

        jdbcTemplate.update("DELETE FROM perfume_reviews WHERE id = ?", REVIEW_ID);
        assertThat(countRows("comments")).isZero();
    }

    /**
     * 작성자가 탈퇴해도 댓글은 남고 닉네임만 비어 나갑니다.
     *
     * <p>{@code comments.user_id} 가 {@code ON DELETE SET NULL} 이라 댓글이 함께 지워지지
     * 않습니다. 대신 주인이 없어져 아무도 고칠 수 없고 {@code mine} 도 항상 거짓입니다.
     */
    @Test
    void keepsCommentAfterTheWriterLeaves() throws Exception {
        long commentId = writeOnPost("남는 댓글");

        jdbcTemplate.update("DELETE FROM users WHERE user_id = ?", WRITER_ID);

        mockMvc.perform(get(POST_COMMENTS_URL, POST_ID))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.comments[0].content").value("남는 댓글"))
                .andExpect(jsonPath("$.comments[0].nickname").doesNotExist())
                .andExpect(jsonPath("$.comments[0].mine").value(false));

        currentUser.login(OTHER_WRITER_ID);
        mockMvc.perform(delete(COMMENT_URL, commentId))
                .andExpect(status().isForbidden());
    }

    /**
     * 댓글은 글과 후기 중 <b>한쪽에만</b> 매달립니다.
     *
     * <p>V12 의 {@code CHECK} 제약이 지킵니다. 양쪽이 다 비거나 다 차 있는 댓글은 어느 화면에도
     * 나타나지 못하는 유령이 됩니다. 애플리케이션을 거치지 않는 경로로도 막혀야 하므로 SQL 로
     * 직접 넣어 확인합니다.
     */
    @Test
    void refusesCommentWithoutExactlyOneParent() {
        assertThat(insertFails(null, null)).isTrue();
        assertThat(insertFails(POST_ID, REVIEW_ID)).isTrue();
        assertThat(countRows("comments")).isZero();
    }

    // ────────────────────────────────────────────────────────────────
    // 문서
    // ────────────────────────────────────────────────────────────────

    /**
     * API 문서에 여섯 개가 모두 실립니다.
     *
     * <p>문서 애노테이션은 코드와 달라져도 컴파일러가 잡아주지 않습니다. 엔드포인트를 지우거나
     * 옮겼는데 문서만 남는 일을 이 테스트가 막습니다.
     */
    @Test
    void documentsAllCommentEndpoints() throws Exception {
        mockMvc.perform(get("/v3/api-docs"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.paths['/api/v1/posts/{postId}/comments'].get").exists())
                .andExpect(jsonPath("$.paths['/api/v1/posts/{postId}/comments'].post").exists())
                .andExpect(jsonPath("$.paths['/api/v1/reviews/{reviewId}/comments'].get").exists())
                .andExpect(jsonPath("$.paths['/api/v1/reviews/{reviewId}/comments'].post").exists())
                .andExpect(jsonPath("$.paths['/api/v1/comments/{commentId}'].patch").exists())
                .andExpect(jsonPath("$.paths['/api/v1/comments/{commentId}'].delete").exists());
    }

    // ────────────────────────────────────────────────────────────────
    // 도우미
    // ────────────────────────────────────────────────────────────────

    private long writeOnPost(String content) throws Exception {
        return write(POST_COMMENTS_URL, POST_ID, content);
    }

    private long writeOnReview(String content) throws Exception {
        return write(REVIEW_COMMENTS_URL, REVIEW_ID, content);
    }

    private long write(String url, long parentId, String content) throws Exception {
        String body = mockMvc.perform(post(url, parentId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(commentBody(content)))
                .andExpect(status().isCreated())
                .andReturn()
                .getResponse()
                .getContentAsString();

        JsonNode json = objectMapper.readTree(body);
        return json.get("commentId").asLong();
    }

    /** {@code {"content": "..."}} 를 만듭니다. 따옴표나 줄바꿈이 들어가도 안전합니다. */
    private String commentBody(String content) throws Exception {
        return "{\"content\": " + objectMapper.writeValueAsString(content) + "}";
    }

    /** 작성 시각을 1분 전으로 되돌립니다. 고친 시각이 작성 시각보다 뒤인지 보려는 것입니다. */
    private void agePastComment(long commentId) {
        jdbcTemplate.update("""
                UPDATE comments
                SET created_at = NOW() - INTERVAL '1 minute',
                    updated_at = NOW() - INTERVAL '1 minute'
                WHERE comment_id = ?
                """, commentId);
    }

    /** 제약에 걸려 저장이 실패하면 참입니다. */
    private boolean insertFails(Long postId, Long reviewId) {
        try {
            jdbcTemplate.update("""
                    INSERT INTO comments (post_id, review_id, user_id, content,
                                          created_at, updated_at)
                    VALUES (?, ?, ?, '제약 확인', NOW(), NOW())
                    """, postId, reviewId, WRITER_ID);
            return false;
        } catch (RuntimeException exception) {
            return true;
        }
    }

    private long countRows(String table) {
        return jdbcTemplate.queryForObject("SELECT COUNT(*) FROM " + table, Long.class);
    }

    private void insertUser(long id, String email, String nickname) {
        jdbcTemplate.update(
                "INSERT INTO users (user_id, email, password_hash, nickname) VALUES (?, ?, 'x', ?)",
                id, email, nickname);
    }

    /**
     * 테스트가 넣은 것만 지웁니다. 지우는 순서가 중요합니다.
     *
     * <p>외래키가 걸려 있어 자식부터 지워야 합니다. 댓글이 글·후기를 가리키고, 글·후기가 사용자와
     * 향수를 가리킵니다. 순서를 바꾸면 제약 위반으로 실패합니다.
     *
     * <p>{@code post_categories} 는 마이그레이션이 심은 분류 셋이라 건드리지 않습니다.
     */
    private void clearData() {
        jdbcTemplate.update("DELETE FROM comments");
        jdbcTemplate.update("DELETE FROM post_images");
        jdbcTemplate.update("DELETE FROM post_perfumes");
        jdbcTemplate.update("DELETE FROM posts");
        jdbcTemplate.update("DELETE FROM perfume_review_seasons");
        jdbcTemplate.update("DELETE FROM perfume_reviews");
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
