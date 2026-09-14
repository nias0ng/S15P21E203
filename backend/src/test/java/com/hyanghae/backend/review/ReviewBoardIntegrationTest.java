package com.hyanghae.backend.review;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.hyanghae.backend.global.security.CurrentUser;
import com.hyanghae.backend.review.exception.ReviewErrorCode;
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
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

/**
 * 후기 게시판 목록·상세와 좋아요·조회수를 실제 PostgreSQL 위에서 검증합니다.
 *
 * <p>향수 상세의 후기 목록({@code /perfumes/{perfumeId}/reviews})은
 * {@link ReviewIntegrationTest} 가 봅니다. 여기는 <b>향수를 가리지 않는 게시판</b>입니다.
 *
 * <p>후기는 API 가 아니라 SQL 로 직접 넣습니다. 한 사용자가 한 향수에 후기를 하나만 가질 수 있어
 * (V5 유니크 제약), API 로 여러 개를 만들려면 향수나 사용자를 계속 바꿔야 합니다. 목록 순서를 보는
 * 테스트에서는 그게 본론을 가립니다.
 *
 * <p>인증이 아직 없어 {@link CurrentUser} 를 대역으로 바꿔 로그인한 경우를 만듭니다.
 */
@IntegrationTest
@AutoConfigureMockMvc
@ActiveProfiles({"manual-test", "test"})
class ReviewBoardIntegrationTest {

    private static final String BOARD_URL = "/api/v1/reviews";
    private static final String REVIEW_URL = "/api/v1/reviews/{reviewId}";
    private static final String LIKE_URL = "/api/v1/reviews/{reviewId}/like";

    private static final long WRITER_ID = 1;
    private static final long OTHER_WRITER_ID = 2;

    private static final long MISSING_ID = 999;

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Autowired
    private FakeCurrentUser currentUser;

    @BeforeEach
    void insertFixtures() {
        clearData();

        jdbcTemplate.update("""
                INSERT INTO users (user_id, email, password_hash, nickname)
                VALUES (?, 'writer@hyanghae.test', 'x', '글쓴이'),
                       (?, 'other@hyanghae.test', 'x', '다른 사람')
                """, WRITER_ID, OTHER_WRITER_ID);

        jdbcTemplate.update(
                "INSERT INTO brands (brand_id, name, is_active) VALUES (1, 'Chanel', TRUE)");
        // 한 사람이 한 향수에 후기를 하나만 가질 수 있어(V5 유니크 제약), 후기를 여러 개 만드는
        // 테스트에는 향수도 그만큼 필요합니다.
        jdbcTemplate.update("""
                INSERT INTO perfumes (perfume_id, brand_id, name, is_active)
                VALUES (1, 1, 'Base Scent', TRUE),
                       (2, NULL, 'No Brand Scent', TRUE),
                       (3, 1, 'Third Scent', TRUE),
                       (4, 1, 'Fourth Scent', TRUE),
                       (5, 1, 'Fifth Scent', TRUE)
                """);

        currentUser.login(WRITER_ID);
    }

    @AfterEach
    void cleanUp() {
        currentUser.logout();
        clearData();
    }

    // ────────────────────────────────────────────────────────────────
    // 목록
    // ────────────────────────────────────────────────────────────────

    /**
     * 목록 한 줄에 <b>향수가 함께</b> 실립니다.
     *
     * <p>향수 상세의 후기 목록과 다른 점입니다. 게시판은 여러 향수의 후기가 섞여 나오므로 줄마다
     * 어느 향수 이야기인지 보여야 합니다. 와이어프레임 A22a 의 "향수 블록이 없는 후기는 없다" 가
     * 이 자리입니다.
     */
    @Test
    void putsThePerfumeInEachRow() throws Exception {
        insertReview(1, WRITER_ID, 1, "샤넬 후기", "향이 좋습니다.");

        mockMvc.perform(get(BOARD_URL))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(1))
                .andExpect(jsonPath("$.page").value(0))
                .andExpect(jsonPath("$.size").value(10))
                .andExpect(jsonPath("$.reviews[0].reviewId").value(1))
                .andExpect(jsonPath("$.reviews[0].title").value("샤넬 후기"))
                .andExpect(jsonPath("$.reviews[0].content").value("향이 좋습니다."))
                .andExpect(jsonPath("$.reviews[0].nickname").value("글쓴이"))
                .andExpect(jsonPath("$.reviews[0].perfume.perfumeId").value(1))
                .andExpect(jsonPath("$.reviews[0].perfume.name").value("Base Scent"))
                .andExpect(jsonPath("$.reviews[0].perfume.brand").value("Chanel"))
                .andExpect(jsonPath("$.reviews[0].likeCount").value(0))
                .andExpect(jsonPath("$.reviews[0].viewCount").value(0))
                .andExpect(jsonPath("$.reviews[0].liked").value(false))
                .andExpect(jsonPath("$.reviews[0].createdAt").isNotEmpty());
    }

    /**
     * 브랜드가 없는 향수의 후기도 목록에 나옵니다.
     *
     * <p>브랜드 조인이 안쪽이면 이런 후기가 게시판에서 통째로 사라집니다. 사라지는 것은 눈에 잘
     * 띄지 않아 한참 뒤에야 발견됩니다.
     */
    @Test
    void keepsReviewsOfPerfumesWithoutABrand() throws Exception {
        insertReview(1, WRITER_ID, 2, "브랜드 없는 향수 후기", "그래도 좋습니다.");

        mockMvc.perform(get(BOARD_URL))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(1))
                .andExpect(jsonPath("$.reviews[0].perfume.perfumeId").value(2))
                .andExpect(jsonPath("$.reviews[0].perfume.brand").doesNotExist());
    }

    /** 게시판은 향수를 가리지 않습니다. 향수가 달라도 한 목록에 섞여 나옵니다. */
    @Test
    void mixesReviewsOfEveryPerfume() throws Exception {
        insertReview(1, WRITER_ID, 1, "첫 후기", "본문");
        insertReview(2, WRITER_ID, 2, "둘째 후기", "본문");
        insertReview(3, OTHER_WRITER_ID, 1, "셋째 후기", "본문");

        mockMvc.perform(get(BOARD_URL))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(3))
                .andExpect(jsonPath("$.reviews[*].title")
                        .value(Matchers.contains("셋째 후기", "둘째 후기", "첫 후기")));
    }

    /** 페이지 크기는 1~100 으로 자릅니다. 총 개수는 자른 것과 무관하게 전체입니다. */
    @Test
    void clampsPageSize() throws Exception {
        insertReview(1, WRITER_ID, 1, "첫 후기", "본문");
        insertReview(2, WRITER_ID, 2, "둘째 후기", "본문");

        mockMvc.perform(get(BOARD_URL).param("size", "1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.reviews.length()").value(1))
                .andExpect(jsonPath("$.totalElements").value(2));

        mockMvc.perform(get(BOARD_URL).param("size", "500"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.size").value(100));
    }

    /** 후기가 없으면 빈 배열입니다. {@code null} 이 아닙니다. */
    @Test
    void returnsAnEmptyArrayWhenThereAreNoReviews() throws Exception {
        mockMvc.perform(get(BOARD_URL))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.reviews").isArray())
                .andExpect(jsonPath("$.reviews").isEmpty())
                .andExpect(jsonPath("$.totalElements").value(0));
    }

    // ────────────────────────────────────────────────────────────────
    // 정렬
    // ────────────────────────────────────────────────────────────────

    /** 정렬 셋을 모두 받습니다. 화면의 정렬 칩과 하나씩 맞습니다. */
    @Test
    void acceptsEverySort() throws Exception {
        for (String sort : new String[]{"RECENT", "VIEWS", "LIKES"}) {
            mockMvc.perform(get(BOARD_URL).param("sort", sort))
                    .andExpect(status().isOk());
        }
    }

    /**
     * 후기 게시판에는 <b>댓글 순이 없습니다.</b>
     *
     * <p>후기에는 댓글을 달지 않기 때문입니다(와이어프레임 A22a — 후기는 좋아요만). 자유 게시판과
     * 정렬 enum 을 따로 둔 이유가 이것입니다.
     */
    @Test
    void rejectsCommentSort() throws Exception {
        mockMvc.perform(get(BOARD_URL).param("sort", "COMMENTS"))
                .andExpect(status().isBadRequest());
    }

    /** 좋아요 순은 많이 받은 후기가 먼저입니다. */
    @Test
    void sortsByLikeCount() throws Exception {
        insertReview(1, WRITER_ID, 1, "하나 받은 후기", "본문");
        insertReview(2, WRITER_ID, 2, "둘 받은 후기", "본문");

        mockMvc.perform(put(LIKE_URL, 1L)).andExpect(status().isOk());
        mockMvc.perform(put(LIKE_URL, 2L)).andExpect(status().isOk());
        currentUser.login(OTHER_WRITER_ID);
        mockMvc.perform(put(LIKE_URL, 2L)).andExpect(status().isOk());

        mockMvc.perform(get(BOARD_URL).param("sort", "LIKES"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.reviews[*].title")
                        .value(Matchers.contains("둘 받은 후기", "하나 받은 후기")));
    }

    /** 조회 순은 많이 열린 후기가 먼저입니다. */
    @Test
    void sortsByViewCount() throws Exception {
        insertReview(1, WRITER_ID, 1, "덜 열린 후기", "본문");
        insertReview(2, WRITER_ID, 2, "많이 열린 후기", "본문");

        mockMvc.perform(get(REVIEW_URL, 1L)).andExpect(status().isOk());
        mockMvc.perform(get(REVIEW_URL, 2L)).andExpect(status().isOk());
        mockMvc.perform(get(REVIEW_URL, 2L)).andExpect(status().isOk());

        mockMvc.perform(get(BOARD_URL).param("sort", "VIEWS"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.reviews[*].title")
                        .value(Matchers.contains("많이 열린 후기", "덜 열린 후기")));
    }

    /**
     * 좋아요 수가 같아도 페이지를 넘길 때 겹치거나 빠지는 후기가 없습니다.
     *
     * <p>정렬 기준이 첫째 하나뿐이면 값이 같은 행들의 순서를 데이터베이스가 보장하지 않습니다.
     * 그러면 같은 후기가 두 페이지에 나오거나 어떤 후기가 아예 안 보입니다.
     */
    @Test
    void keepsOrderStableWhenLikeCountsTie() throws Exception {
        for (int id = 1; id <= 5; id++) {
            insertReview(id, WRITER_ID, id, "후기 " + id, "본문");
        }

        java.util.List<String> seen = new java.util.ArrayList<>();
        for (int page = 0; page < 3; page++) {
            String body = mockMvc.perform(get(BOARD_URL)
                            .param("sort", "LIKES")
                            .param("size", "2")
                            .param("page", String.valueOf(page)))
                    .andExpect(status().isOk())
                    .andReturn()
                    .getResponse()
                    .getContentAsString();
            java.util.regex.Matcher matcher =
                    java.util.regex.Pattern.compile("\"title\":\"(후기 \\d)\"").matcher(body);
            while (matcher.find()) {
                seen.add(matcher.group(1));
            }
        }

        assertThat(seen).containsExactlyInAnyOrder(
                "후기 1", "후기 2", "후기 3", "후기 4", "후기 5");
    }

    // ────────────────────────────────────────────────────────────────
    // 상세와 조회수
    // ────────────────────────────────────────────────────────────────

    /** 상세는 로그인 없이 볼 수 있고 {@code mine} 은 보는 사람마다 다릅니다. */
    @Test
    void showsTheDetail() throws Exception {
        insertReview(1, WRITER_ID, 1, "내 후기", "본문입니다.");

        mockMvc.perform(get(REVIEW_URL, 1L))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.reviewId").value(1))
                .andExpect(jsonPath("$.title").value("내 후기"))
                .andExpect(jsonPath("$.content").value("본문입니다."))
                .andExpect(jsonPath("$.nickname").value("글쓴이"))
                .andExpect(jsonPath("$.perfume.name").value("Base Scent"))
                .andExpect(jsonPath("$.seasons").isEmpty())
                .andExpect(jsonPath("$.mine").value(true))
                .andExpect(jsonPath("$.createdAt").isNotEmpty())
                .andExpect(jsonPath("$.updatedAt").isNotEmpty());

        currentUser.login(OTHER_WRITER_ID);
        mockMvc.perform(get(REVIEW_URL, 1L))
                .andExpect(jsonPath("$.mine").value(false));

        currentUser.logout();
        mockMvc.perform(get(REVIEW_URL, 1L))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.mine").value(false));
    }

    /** 상세를 열 때마다 조회수가 오릅니다. 응답의 값은 이번 조회를 포함합니다. */
    @Test
    void countsAViewEachTimeTheDetailOpens() throws Exception {
        insertReview(1, WRITER_ID, 1, "조회될 후기", "본문");

        for (int expected = 1; expected <= 3; expected++) {
            mockMvc.perform(get(REVIEW_URL, 1L))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.viewCount").value(expected));
        }

        mockMvc.perform(get(BOARD_URL))
                .andExpect(jsonPath("$.reviews[0].viewCount").value(3));
    }

    /**
     * 상세 응답의 조회수가 <b>표에 적힌 값과 같습니다.</b>
     *
     * <p>올린 뒤에 읽고, 읽는 문장이 네이티브 쿼리라 영속성 컨텍스트를 거치지 않습니다. 캐시된
     * 값을 읽을 자리가 아예 없습니다. 글 쪽과 같은 것을 확인합니다.
     */
    @Test
    void returnsTheViewCountThatWasJustStored() throws Exception {
        insertReview(1, WRITER_ID, 1, "조회될 후기", "본문");

        mockMvc.perform(get(REVIEW_URL, 1L))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.viewCount").value(1));

        assertThat(jdbcTemplate.queryForObject(
                "SELECT view_count FROM perfume_reviews WHERE id = 1", Long.class))
                .isEqualTo(1);
    }

    /** 없는 후기는 404 이고 조회수도 생기지 않습니다. */
    @Test
    void rejectsMissingReview() throws Exception {
        mockMvc.perform(get(REVIEW_URL, MISSING_ID))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code")
                        .value(ReviewErrorCode.REVIEW_NOT_FOUND.code()));
    }

    /** 작성자가 탈퇴해도 후기는 남고 닉네임만 비어 나갑니다. */
    @Test
    void keepsReviewAfterTheWriterLeaves() throws Exception {
        insertReview(1, WRITER_ID, 1, "남는 후기", "본문");

        jdbcTemplate.update("DELETE FROM users WHERE user_id = ?", WRITER_ID);

        mockMvc.perform(get(REVIEW_URL, 1L))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.title").value("남는 후기"))
                .andExpect(jsonPath("$.nickname").doesNotExist())
                .andExpect(jsonPath("$.mine").value(false));
    }

    // ────────────────────────────────────────────────────────────────
    // 좋아요
    // ────────────────────────────────────────────────────────────────

    /** 여러 번 눌러도 결과가 같습니다. 취소도 마찬가지입니다. */
    @Test
    void likesAndUnlikesIdempotently() throws Exception {
        insertReview(1, WRITER_ID, 1, "좋아요 받을 후기", "본문");

        for (int attempt = 0; attempt < 3; attempt++) {
            mockMvc.perform(put(LIKE_URL, 1L))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.reviewId").value(1))
                    .andExpect(jsonPath("$.liked").value(true))
                    .andExpect(jsonPath("$.likeCount").value(1));
        }
        assertThat(countRows("review_likes")).isEqualTo(1);

        for (int attempt = 0; attempt < 3; attempt++) {
            mockMvc.perform(delete(LIKE_URL, 1L))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.liked").value(false))
                    .andExpect(jsonPath("$.likeCount").value(0));
        }
        assertThat(countRows("review_likes")).isZero();
    }

    /**
     * 같은 사람이 동시에 여러 번 눌러도 좋아요는 하나입니다.
     *
     * <p>{@code review_likes} 에도 {@code ON CONFLICT DO NOTHING} 이 걸려 있는지 봅니다. 먼저
     * 확인하고 없으면 넣는 식이었다면, 여덟 요청이 모두 "없음" 을 보고 모두 넣으려 해 일곱이
     * 기본키 충돌로 500 을 받습니다.
     *
     * <p>글 좋아요는 {@code PostLikeConcurrencyIntegrationTest} 가 사람을 바꿔 가며 더 넓게
     * 봅니다. 여기서는 후기 쪽 표에도 같은 장치가 걸려 있다는 것만 확인합니다. 한 사람으로
     * 충분한 이유는 막아야 할 것이 <b>같은 사람의 중복</b>이기 때문입니다.
     */
    @Test
    void keepsOneLikeWhenTheSamePersonPressesConcurrently() throws Exception {
        insertReview(1, WRITER_ID, 1, "경합 대상 후기", "본문");

        int concurrent = 8;
        CyclicBarrier gate = new CyclicBarrier(concurrent);
        ExecutorService pool = Executors.newFixedThreadPool(concurrent);
        try {
            List<Callable<Integer>> calls = new ArrayList<>();
            for (int index = 0; index < concurrent; index++) {
                calls.add(() -> {
                    gate.await();
                    return mockMvc.perform(put(LIKE_URL, 1L))
                            .andReturn()
                            .getResponse()
                            .getStatus();
                });
            }

            List<Integer> statuses = new ArrayList<>();
            for (Future<Integer> future : pool.invokeAll(calls)) {
                statuses.add(future.get());
            }
            assertThat(statuses).containsOnly(200);
        } finally {
            pool.shutdownNow();
        }

        assertThat(countRows("review_likes")).isEqualTo(1);
        mockMvc.perform(get(BOARD_URL))
                .andExpect(jsonPath("$.reviews[0].likeCount").value(1));
    }

    /** {@code liked} 는 보는 사람마다 다르고 {@code likeCount} 는 누구에게나 같습니다. */
    @Test
    void tellsWhetherILikedTheReview() throws Exception {
        insertReview(1, WRITER_ID, 1, "좋아요 받을 후기", "본문");
        mockMvc.perform(put(LIKE_URL, 1L)).andExpect(status().isOk());

        mockMvc.perform(get(REVIEW_URL, 1L))
                .andExpect(jsonPath("$.likeCount").value(1))
                .andExpect(jsonPath("$.liked").value(true));
        mockMvc.perform(get(BOARD_URL))
                .andExpect(jsonPath("$.reviews[0].liked").value(true));

        currentUser.login(OTHER_WRITER_ID);
        mockMvc.perform(get(REVIEW_URL, 1L))
                .andExpect(jsonPath("$.likeCount").value(1))
                .andExpect(jsonPath("$.liked").value(false));
        mockMvc.perform(get(BOARD_URL))
                .andExpect(jsonPath("$.reviews[0].liked").value(false));

        currentUser.logout();
        mockMvc.perform(get(BOARD_URL))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.reviews[0].likeCount").value(1))
                .andExpect(jsonPath("$.reviews[0].liked").value(false));
    }

    /** 좋아요는 로그인이 필요하고, 없는 후기에는 누를 수 없습니다. */
    @Test
    void rejectsLikeWithoutLoginOrReview() throws Exception {
        insertReview(1, WRITER_ID, 1, "후기", "본문");

        mockMvc.perform(put(LIKE_URL, MISSING_ID))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code")
                        .value(ReviewErrorCode.REVIEW_NOT_FOUND.code()));

        currentUser.logout();
        mockMvc.perform(put(LIKE_URL, 1L)).andExpect(status().isUnauthorized());
        mockMvc.perform(delete(LIKE_URL, 1L)).andExpect(status().isUnauthorized());

        assertThat(countRows("review_likes")).isZero();
    }

    /** 후기를 지우면 좋아요도 사라지고, 탈퇴해도 그 사람의 좋아요가 사라집니다. */
    @Test
    void removesLikesWhenTheReviewOrTheUserGoesAway() throws Exception {
        insertReview(1, WRITER_ID, 1, "첫 후기", "본문");
        insertReview(2, WRITER_ID, 2, "둘째 후기", "본문");

        mockMvc.perform(put(LIKE_URL, 1L)).andExpect(status().isOk());
        currentUser.login(OTHER_WRITER_ID);
        mockMvc.perform(put(LIKE_URL, 2L)).andExpect(status().isOk());
        assertThat(countRows("review_likes")).isEqualTo(2);

        jdbcTemplate.update("DELETE FROM perfume_reviews WHERE id = 1");
        assertThat(countRows("review_likes")).isEqualTo(1);

        jdbcTemplate.update("DELETE FROM users WHERE user_id = ?", OTHER_WRITER_ID);
        assertThat(countRows("review_likes")).isZero();
    }

    // ────────────────────────────────────────────────────────────────
    // 문서
    // ────────────────────────────────────────────────────────────────

    /**
     * API 문서에 넷이 모두 실립니다.
     *
     * <p>문서 애노테이션은 코드와 달라져도 컴파일러가 잡아주지 않습니다. 엔드포인트를 지우거나
     * 옮겼는데 문서만 남는 일을 이 테스트가 막습니다.
     */
    @Test
    void documentsAllBoardEndpoints() throws Exception {
        mockMvc.perform(get("/v3/api-docs"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.paths['/api/v1/reviews'].get").exists())
                .andExpect(jsonPath("$.paths['/api/v1/reviews/{reviewId}'].get").exists())
                .andExpect(jsonPath("$.paths['/api/v1/reviews/{reviewId}/like'].put").exists())
                .andExpect(jsonPath("$.paths['/api/v1/reviews/{reviewId}/like'].delete").exists());
    }

    // ────────────────────────────────────────────────────────────────
    // 도우미
    // ────────────────────────────────────────────────────────────────

    /**
     * 후기를 직접 넣습니다.
     *
     * <p>작성 시각을 번호만큼 뒤로 밉니다. {@code NOW()} 로 한꺼번에 넣으면 시각이 모두 같아져
     * 최신순이 번호로만 갈리는데, 그러면 정렬이 시각을 제대로 보는지 확인할 수 없습니다.
     */
    private void insertReview(long id, long userId, long perfumeId, String title, String content) {
        jdbcTemplate.update("""
                INSERT INTO perfume_reviews (id, user_id, perfume_id, title, content,
                                             created_at, updated_at)
                VALUES (?, ?, ?, ?, ?,
                        NOW() + (? * INTERVAL '1 second'), NOW() + (? * INTERVAL '1 second'))
                """, id, userId, perfumeId, title, content, id, id);
    }

    private long countRows(String table) {
        return jdbcTemplate.queryForObject("SELECT COUNT(*) FROM " + table, Long.class);
    }

    /**
     * 테스트가 넣은 것만 지웁니다. 외래키가 걸려 있어 자식부터 지워야 합니다.
     */
    private void clearData() {
        jdbcTemplate.update("DELETE FROM review_likes");
        jdbcTemplate.update("DELETE FROM perfume_review_keywords");
        jdbcTemplate.update("DELETE FROM perfume_review_seasons");
        jdbcTemplate.update("DELETE FROM perfume_reviews");
        jdbcTemplate.update("DELETE FROM perfume_review_summaries");
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
