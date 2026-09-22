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
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.concurrent.Callable;
import java.util.concurrent.CyclicBarrier;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
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
 * <p>댓글은 자유 게시판 글에만 달립니다. 후기에는 댓글을 쓰지 않고 좋아요만 있습니다
 * (와이어프레임 A22a).
 *
 * <p>글은 API 가 아니라 SQL 로 직접 넣습니다. 게시글 API 가 바뀌어도 댓글 테스트가 흔들리지
 * 않아야 합니다.
 */
@IntegrationTest
@AutoConfigureMockMvc
@ActiveProfiles({"manual-test", "test"})
class CommentIntegrationTest {

    private static final String POST_COMMENTS_URL = "/api/v1/posts/{postId}/comments";
    private static final String COMMENT_URL = "/api/v1/comments/{commentId}";

    private static final long WRITER_ID = 1;
    private static final long OTHER_WRITER_ID = 2;

    private static final long POST_ID = 1;
    private static final long MISSING_ID = 999;

    private static final String PROFILE_IMAGE_URL =
            "/api/v1/users/profile-images/2026/09/0a1b2c3d-4e5f-6071-8293-a4b5c6d7e8f9.jpg";

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

        // 자유 게시판 글 하나. 분류는 마이그레이션이 심어 둔 것을 코드로 찾습니다.
        jdbcTemplate.update("""
                INSERT INTO posts (post_id, user_id, category_id, title, content,
                                   created_at, updated_at)
                VALUES (?, ?, (SELECT category_id FROM post_categories WHERE code = 'CHAT'),
                        '글 제목', '글 본문', NOW(), NOW())
                """, POST_ID, WRITER_ID);

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

    /**
     * 댓글에 작성자 프로필 사진 주소가 함께 실립니다.
     *
     * <p>남의 프로필을 따로 조회할 길이 없어, 여기서 주지 않으면 화면이 작성자 아바타 자리를 비운
     * 채 둬야 합니다. 값 규칙은 {@code /users/me} 와 같습니다 — 사진을 설정하지 않았으면
     * {@code null} 이고 화면이 기본 아바타를 보여줍니다.
     */
    @Test
    void putsTheAuthorProfileImageInEachComment() throws Exception {
        writeOnPost("사진 있는 사람의 댓글");

        mockMvc.perform(get(POST_COMMENTS_URL, POST_ID))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.comments[0].profileImageUrl").doesNotExist());

        jdbcTemplate.update("UPDATE users SET profile_image_url = ? WHERE user_id = ?",
                PROFILE_IMAGE_URL, WRITER_ID);

        mockMvc.perform(get(POST_COMMENTS_URL, POST_ID))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.comments[0].nickname").value("글쓴이"))
                .andExpect(jsonPath("$.comments[0].profileImageUrl").value(PROFILE_IMAGE_URL));
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
     * 없는 글에는 댓글을 달 수도, 목록을 볼 수도 없습니다.
     *
     * <p>목록도 404 입니다. 확인하지 않으면 없는 글 번호로 조회해도 "댓글 0개" 가 돌아가서, 화면이
     * "글이 없다" 와 "댓글이 없다" 를 구분하지 못합니다.
     */
    @Test
    void rejectsMissingPost() throws Exception {
        mockMvc.perform(post(POST_COMMENTS_URL, MISSING_ID)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(commentBody("없는 글에 답니다.")))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code")
                        .value(CommunityErrorCode.COMMUNITY_POST_NOT_FOUND.code()));

        mockMvc.perform(get(POST_COMMENTS_URL, MISSING_ID))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code")
                        .value(CommunityErrorCode.COMMUNITY_POST_NOT_FOUND.code()));

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

    /** 글을 지우면 댓글도 함께 사라집니다. 외래키가 지웁니다. */
    @Test
    void deletesCommentsWhenThePostGoesAway() throws Exception {
        writeOnPost("글의 댓글");
        assertThat(countRows("comments")).isEqualTo(1);

        jdbcTemplate.update("DELETE FROM posts WHERE post_id = ?", POST_ID);
        assertThat(countRows("comments")).isZero();
    }

    /**
     * 작성자가 탈퇴해도 댓글은 남고 닉네임과 프로필 사진만 비어 나갑니다.
     *
     * <p>{@code comments.user_id} 가 {@code ON DELETE SET NULL} 이라 댓글이 함께 지워지지
     * 않습니다. 대신 주인이 없어져 아무도 고칠 수 없고 {@code mine} 도 항상 거짓입니다.
     */
    @Test
    void keepsCommentAfterTheWriterLeaves() throws Exception {
        long commentId = writeOnPost("남는 댓글");
        jdbcTemplate.update("UPDATE users SET profile_image_url = ? WHERE user_id = ?",
                PROFILE_IMAGE_URL, WRITER_ID);

        jdbcTemplate.update("DELETE FROM users WHERE user_id = ?", WRITER_ID);

        mockMvc.perform(get(POST_COMMENTS_URL, POST_ID))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.comments[0].content").value("남는 댓글"))
                .andExpect(jsonPath("$.comments[0].nickname").doesNotExist())
                .andExpect(jsonPath("$.comments[0].profileImageUrl").doesNotExist())
                .andExpect(jsonPath("$.comments[0].mine").value(false));

        currentUser.login(OTHER_WRITER_ID);
        mockMvc.perform(delete(COMMENT_URL, commentId))
                .andExpect(status().isForbidden());
    }

    /**
     * 매달릴 글이 없는 댓글은 만들 수 없습니다.
     *
     * <p>V12 가 {@code post_id} 에 건 {@code NOT NULL} 이 지킵니다. 비어 있으면 어느 화면에도
     * 나타나지 못하는 유령 행이 됩니다. 애플리케이션을 거치지 않는 경로로도 막혀야 하므로 SQL 로
     * 직접 넣어 확인합니다.
     */
    @Test
    void refusesCommentWithoutAPost() {
        assertThat(insertFails(null)).isTrue();
        assertThat(countRows("comments")).isZero();
    }

    /**
     * 같은 댓글을 동시에 지워도 결과가 하나로 정해집니다.
     *
     * <p>수정·삭제는 잠그고 읽습니다. 먼저 들어온 쪽이 행을 잠그고 지운 뒤 커밋하면, 기다리던 쪽은
     * 그때서야 조회하고 아무것도 찾지 못해 404 로 답합니다. 잠금이 없으면 둘 다 조회에 성공해
     * 양쪽 모두 204 를 받고, 화면은 지워지지 않은 댓글을 지웠다고 믿습니다.
     *
     * <p>두 요청이 같은 순간에 출발하도록 관문으로 맞춥니다. 어느 쪽이 이기는지는 그때그때
     * 다르지만, <b>정확히 하나만 성공</b>한다는 결과는 매번 같아야 합니다.
     */
    @Test
    void serializesConcurrentDeletes() throws Exception {
        long commentId = writeOnPost("경합 댓글");

        List<Integer> statuses = runTogether(
                () -> deleteStatusOf(commentId),
                () -> deleteStatusOf(commentId));

        assertThat(statuses).containsExactlyInAnyOrder(204, 404);
        assertThat(countRows("comments")).isZero();
    }

    // ────────────────────────────────────────────────────────────────
    // 문서
    // ────────────────────────────────────────────────────────────────

    /**
     * API 문서에 네 개가 모두 실리고, 후기 쪽 경로는 남아 있지 않습니다.
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
                .andExpect(jsonPath("$.paths['/api/v1/comments/{commentId}'].patch").exists())
                .andExpect(jsonPath("$.paths['/api/v1/comments/{commentId}'].delete").exists())
                .andExpect(jsonPath("$.paths['/api/v1/reviews/{reviewId}/comments']")
                        .doesNotExist());
    }

    // ────────────────────────────────────────────────────────────────
    // 도우미
    // ────────────────────────────────────────────────────────────────

    /** 두 요청을 같은 순간에 출발시키고 상태 코드를 모읍니다. */
    private List<Integer> runTogether(Callable<Integer> first, Callable<Integer> second)
            throws Exception {
        CyclicBarrier gate = new CyclicBarrier(2);
        ExecutorService pool = Executors.newFixedThreadPool(2);

        try {
            List<Future<Integer>> futures = pool.invokeAll(List.of(
                    atGate(gate, first),
                    atGate(gate, second)));

            List<Integer> statuses = new ArrayList<>();
            for (Future<Integer> future : futures) {
                statuses.add(future.get());
            }
            return statuses;
        } finally {
            pool.shutdownNow();
        }
    }

    private Callable<Integer> atGate(CyclicBarrier gate, Callable<Integer> task) {
        return () -> {
            gate.await();
            return task.call();
        };
    }

    private int deleteStatusOf(long commentId) throws Exception {
        return mockMvc.perform(delete(COMMENT_URL, commentId))
                .andReturn()
                .getResponse()
                .getStatus();
    }

    private long writeOnPost(String content) throws Exception {
        String body = mockMvc.perform(post(POST_COMMENTS_URL, POST_ID)
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
    private boolean insertFails(Long postId) {
        try {
            jdbcTemplate.update("""
                    INSERT INTO comments (post_id, user_id, content, created_at, updated_at)
                    VALUES (?, ?, '제약 확인', NOW(), NOW())
                    """, postId, WRITER_ID);
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
     * <p>외래키가 걸려 있어 자식부터 지워야 합니다. 댓글이 글을 가리키고, 글이 사용자를 가리킵니다.
     * 순서를 바꾸면 제약 위반으로 실패합니다.
     *
     * <p>{@code post_categories} 는 마이그레이션이 심은 분류 셋이라 건드리지 않습니다.
     */
    private void clearData() {
        jdbcTemplate.update("DELETE FROM comments");
        jdbcTemplate.update("DELETE FROM post_images");
        jdbcTemplate.update("DELETE FROM post_perfumes");
        jdbcTemplate.update("DELETE FROM posts");
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
