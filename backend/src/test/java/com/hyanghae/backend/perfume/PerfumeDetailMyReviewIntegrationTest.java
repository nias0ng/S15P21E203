package com.hyanghae.backend.perfume;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.hyanghae.backend.global.security.CurrentUser;
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

/**
 * 향수 상세의 {@code myReviewId} 를 검증합니다.
 *
 * <p>화면이 [후기 쓰기] 와 [후기 수정] 중 무엇을 띄울지 정하는 값입니다. 한 사람은 한 향수에
 * 후기를 하나만 가질 수 있어({@code uk_perfume_reviews_user_perfume}), 이미 쓴 향수에 또 쓰려
 * 하면 409 가 납니다. 이 값이 없으면 화면이 그것을 미리 알 수 없어 사용자가 후기를 다 쓰고
 * 나서야 막힙니다.
 *
 * <p>{@link PerfumeDetailIntegrationTest} 와 나눈 이유는 이 값만 <b>보는 사람에 따라</b>
 * 달라지기 때문입니다. 나머지 필드는 누가 봐도 같아서 로그인 대역이 필요 없습니다.
 */
@IntegrationTest
@AutoConfigureMockMvc
class PerfumeDetailMyReviewIntegrationTest {

    private static final String DETAIL_URL = "/api/v1/perfumes/{perfumeId}";

    private static final long WRITER_ID = 1;
    private static final long OTHER_WRITER_ID = 2;

    private static final long REVIEWED_PERFUME_ID = 1;
    private static final long UNREVIEWED_PERFUME_ID = 2;

    private static final long REVIEW_ID = 10;

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

        jdbcTemplate.update("""
                INSERT INTO perfumes (perfume_id, name, is_active)
                VALUES (?, 'Reviewed Scent', TRUE), (?, 'Untouched Scent', TRUE)
                """, REVIEWED_PERFUME_ID, UNREVIEWED_PERFUME_ID);

        jdbcTemplate.update("""
                INSERT INTO perfume_reviews (id, user_id, perfume_id, title, content,
                                             created_at, updated_at)
                VALUES (?, ?, ?, '내 후기', '향이 좋습니다.', NOW(), NOW())
                """, REVIEW_ID, WRITER_ID, REVIEWED_PERFUME_ID);

        currentUser.login(WRITER_ID);
    }

    @AfterEach
    void cleanUp() {
        currentUser.logout();
        clearData();
    }

    /** 내가 쓴 후기가 있으면 그 번호가 나갑니다. 화면은 이걸 보고 [후기 수정] 을 띄웁니다. */
    @Test
    void tellsMyReviewIdWhenIHaveWrittenOne() throws Exception {
        mockMvc.perform(get(DETAIL_URL, REVIEWED_PERFUME_ID))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.perfumeId").value(REVIEWED_PERFUME_ID))
                .andExpect(jsonPath("$.myReviewId").value(REVIEW_ID));
    }

    /** 안 쓴 향수는 비어 나갑니다. 화면은 [후기 쓰기] 를 띄웁니다. */
    @Test
    void leavesMyReviewIdEmptyWhenIHaveNotWrittenOne() throws Exception {
        mockMvc.perform(get(DETAIL_URL, UNREVIEWED_PERFUME_ID))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.myReviewId").doesNotExist());
    }

    /**
     * 남이 쓴 후기는 내 것이 아닙니다.
     *
     * <p>향수 번호만 보고 후기를 찾으면 남의 후기 번호가 나가고, 화면은 [후기 수정] 을 띄웠다가
     * 403 을 받습니다. 사용자 번호를 함께 봐야 합니다.
     */
    @Test
    void doesNotLeakSomeoneElsesReview() throws Exception {
        currentUser.login(OTHER_WRITER_ID);

        mockMvc.perform(get(DETAIL_URL, REVIEWED_PERFUME_ID))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.myReviewId").doesNotExist());
    }

    /**
     * 비로그인도 향수 상세를 볼 수 있고 {@code myReviewId} 만 비어 나갑니다.
     *
     * <p>여기서 401 을 내면 로그인하지 않은 사람이 향수를 아예 못 봅니다. 화면은 [후기 쓰기] 를
     * 띄워 두었다가 누를 때 로그인을 요구하면 됩니다.
     */
    @Test
    void allowsAnonymousAccess() throws Exception {
        currentUser.logout();

        mockMvc.perform(get(DETAIL_URL, REVIEWED_PERFUME_ID))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.name").value("Reviewed Scent"))
                .andExpect(jsonPath("$.myReviewId").doesNotExist());
    }

    /** 후기를 지우면 다시 비어 나갑니다. 화면이 [후기 쓰기] 로 돌아갑니다. */
    @Test
    void clearsMyReviewIdAfterTheReviewIsDeleted() throws Exception {
        mockMvc.perform(get(DETAIL_URL, REVIEWED_PERFUME_ID))
                .andExpect(jsonPath("$.myReviewId").value(REVIEW_ID));

        jdbcTemplate.update("DELETE FROM perfume_reviews WHERE id = ?", REVIEW_ID);

        mockMvc.perform(get(DETAIL_URL, REVIEWED_PERFUME_ID))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.myReviewId").doesNotExist());
    }

    private void clearData() {
        jdbcTemplate.update("DELETE FROM review_likes");
        jdbcTemplate.update("DELETE FROM perfume_review_keywords");
        jdbcTemplate.update("DELETE FROM perfume_review_seasons");
        jdbcTemplate.update("DELETE FROM perfume_reviews");
        jdbcTemplate.update("DELETE FROM perfume_review_summaries");
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
