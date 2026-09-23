package com.hyanghae.backend.review;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.hyanghae.backend.global.security.CurrentUser;
import com.hyanghae.backend.support.IntegrationTest;
import java.util.Optional;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Primary;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

@IntegrationTest
@AutoConfigureMockMvc
@ActiveProfiles({"manual-test", "test"})
class ReviewIntegrationTest {

    private static final String PERFUME_REVIEWS_URL = "/api/v1/perfumes/1/reviews";
    private static final String REVIEWS_URL = "/api/v1/reviews";

    private static final String PROFILE_IMAGE_URL =
            "/api/v1/users/profile-images/2026/09/0a1b2c3d-4e5f-6071-8293-a4b5c6d7e8f9.jpg";

    @Autowired
    MockMvc mockMvc;

    @Autowired
    ObjectMapper objectMapper;

    @Autowired
    JdbcTemplate jdbcTemplate;

    @Autowired
    FakeCurrentUser fakeCurrentUser;

    @BeforeEach
    void setUp() {
        clearData();
        jdbcTemplate.update("""
                INSERT INTO users (user_id, email, password_hash, nickname)
                VALUES (1, 'first@example.com', 'password', '첫째'),
                       (2, 'second@example.com', 'password', '둘째')
                """);
        jdbcTemplate.update("""
                INSERT INTO perfumes (perfume_id, name, is_active)
                VALUES (1, 'Active', TRUE), (2, 'Inactive', FALSE)
                """);
        jdbcTemplate.update("""
                INSERT INTO seasons (season_id, code, name, is_active)
                VALUES (1, 'SPRING', '봄', TRUE),
                       (2, 'SUMMER', '여름', TRUE),
                       (3, 'AUTUMN', '가을', TRUE),
                       (4, 'WINTER', '겨울', TRUE),
                       (5, 'OLD', '비활성', FALSE)
                """);
        fakeCurrentUser.login(1L);
    }

    @AfterEach
    void clearData() {
        jdbcTemplate.update("DELETE FROM review_likes");
        jdbcTemplate.update("DELETE FROM perfume_review_keywords");
        jdbcTemplate.update("DELETE FROM perfume_review_seasons");
        jdbcTemplate.update("DELETE FROM perfume_reviews");
        jdbcTemplate.update("DELETE FROM perfume_review_summaries");
        jdbcTemplate.update("DELETE FROM seasons");
        jdbcTemplate.update("DELETE FROM perfumes");
        jdbcTemplate.update("DELETE FROM users");
    }

    @Test
    void createsAndListsReviewWithSeasons() throws Exception {
        long reviewId = createReview("첫 후기", "향이 은은하고 잔향이 오래 남습니다.", "[\"SPRING\",\"SUMMER\"]");

        mockMvc.perform(get(PERFUME_REVIEWS_URL))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.reviews[0].reviewId").value(reviewId))
                .andExpect(jsonPath("$.reviews[0].nickname").value("첫째"))
                .andExpect(jsonPath("$.reviews[0].seasons[0].code").value("SPRING"))
                .andExpect(jsonPath("$.reviews[0].seasons[1].name").value("여름"))
                .andExpect(jsonPath("$.reviews[0].mine").value(true))
                .andExpect(jsonPath("$.page").value(0))
                .andExpect(jsonPath("$.size").value(10))
                .andExpect(jsonPath("$.totalElements").value(1));

        fakeCurrentUser.logout();
        mockMvc.perform(get(PERFUME_REVIEWS_URL))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.reviews[0].mine").value(false));
    }

    /**
     * 목록에 작성자 프로필 사진 주소가 함께 실립니다.
     *
     * <p>남의 프로필을 따로 조회할 길이 없어, 여기서 주지 않으면 화면이 작성자 아바타 자리를 비운
     * 채 둬야 합니다. 값 규칙은 {@code /users/me} 와 같습니다 — 사진을 설정하지 않았으면
     * {@code null} 이고 화면이 기본 아바타를 보여줍니다.
     */
    @Test
    void listsAuthorProfileImage() throws Exception {
        createReview("첫 후기", "향이 은은하고 잔향이 오래 남습니다.", "[\"SPRING\"]");

        mockMvc.perform(get(PERFUME_REVIEWS_URL))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.reviews[0].profileImageUrl").doesNotExist());

        jdbcTemplate.update(
                "UPDATE users SET profile_image_url = ? WHERE user_id = 1", PROFILE_IMAGE_URL);

        mockMvc.perform(get(PERFUME_REVIEWS_URL))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.reviews[0].nickname").value("첫째"))
                .andExpect(jsonPath("$.reviews[0].profileImageUrl").value(PROFILE_IMAGE_URL));
    }

    @Test
    void rejectsSecondReviewForSameUserAndPerfume() throws Exception {
        createReview("첫 후기", "처음 작성한 향수 후기입니다.", "[\"SPRING\"]");

        mockMvc.perform(post(PERFUME_REVIEWS_URL)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(reviewBody("두 번째", "다시 작성하려는 향수 후기입니다.", "[\"SUMMER\"]")))
                .andExpect(status().isConflict());

        fakeCurrentUser.login(2L);
        mockMvc.perform(post(PERFUME_REVIEWS_URL)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(reviewBody("다른 사용자", "다른 사용자의 향수 후기입니다.", "[\"SUMMER\"]")))
                .andExpect(status().isCreated());
    }

    @ParameterizedTest
    @ValueSource(strings = {
            "{\"title\":\"\",\"content\":\"충분히 긴 후기 내용입니다.\",\"seasonCodes\":[\"SPRING\"]}",
            "{\"title\":\"제목\",\"content\":\"짧음\",\"seasonCodes\":[\"SPRING\"]}",
            "{\"title\":\"제목\",\"content\":\"충분히 긴 후기 내용입니다.\",\"seasonCodes\":[]}",
            "{\"title\":\"제목\",\"content\":\"충분히 긴 후기 내용입니다.\",\"seasonCodes\":[\"SPRING\",\"SUMMER\",\"AUTUMN\",\"WINTER\",\"SPRING\"]}",
            "{\"title\":\"제목\",\"content\":\"충분히 긴 후기 내용입니다.\",\"seasonCodes\":[\"SPRING\",\"SPRING\"]}"
    })
    void rejectsInvalidCreateRequest(String body) throws Exception {
        mockMvc.perform(post(PERFUME_REVIEWS_URL)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isBadRequest());
    }

    @Test
    void rejectsMissingOrInactiveSeason() throws Exception {
        // 없는 코드입니다. 화면이 내놓지 않는 값이라 오타이거나 옛 코드입니다.
        mockMvc.perform(post(PERFUME_REVIEWS_URL)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(reviewBody("제목", "충분히 긴 후기 내용입니다.", "[\"NOT_A_SEASON\"]")))
                .andExpect(status().isNotFound());

        // 내려간 계절입니다. 표에는 있지만 고를 수 없어야 합니다.
        mockMvc.perform(post(PERFUME_REVIEWS_URL)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(reviewBody("제목", "충분히 긴 후기 내용입니다.", "[\"OLD\"]")))
                .andExpect(status().isNotFound());
    }

    @Test
    void updatesReviewAndKeepsExistingSummary() throws Exception {
        long reviewId = createReview("수정 전", "수정하기 전의 후기 내용입니다.", "[\"SPRING\"]");
        insertSummary();

        mockMvc.perform(patch(REVIEWS_URL + "/" + reviewId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"title\":\"수정 후\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.title").value("수정 후"))
                .andExpect(jsonPath("$.content").value("수정하기 전의 후기 내용입니다."))
                .andExpect(jsonPath("$.updatedAt").exists());

        assertThat(count("perfume_review_summaries")).isOne();
        mockMvc.perform(patch(REVIEWS_URL + "/" + reviewId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{}"))
                .andExpect(status().isBadRequest());
        mockMvc.perform(patch(REVIEWS_URL + "/" + reviewId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"content\":\"  짧음  \"}"))
                .andExpect(status().isBadRequest());
    }

    /**
     * 제목·내용·계절을 한 요청으로 고치고, 응답에 <b>고쳐진 결과 전체</b>가 담깁니다.
     *
     * <p>응답이 보낸 항목만 담으면 화면이 나머지를 알 수 없어 상세를 다시 불러야 합니다.
     */
    @Test
    void updatesTitleContentAndSeasonsInOneRequest() throws Exception {
        long reviewId = createReview("수정 전", "수정하기 전의 후기 내용입니다.", "[\"SPRING\"]");

        mockMvc.perform(patch(REVIEWS_URL + "/" + reviewId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"title":"수정 후","seasonCodes":["AUTUMN","WINTER"]}
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.title").value("수정 후"))
                .andExpect(jsonPath("$.content").value("수정하기 전의 후기 내용입니다."))
                .andExpect(jsonPath("$.seasonCodes[0]").value("AUTUMN"))
                .andExpect(jsonPath("$.seasonCodes[1]").value("WINTER"));

        assertThat(jdbcTemplate.queryForList(
                "SELECT season_id FROM perfume_review_seasons WHERE review_id = ? ORDER BY season_id",
                Long.class,
                reviewId
        )).containsExactly(3L, 4L);
    }

    /**
     * 계절만 보내는 수정도 됩니다. 화면에서 계절 칩만 바꾸고 저장하는 경우입니다.
     */
    @Test
    void updatesSeasonsAlone() throws Exception {
        long reviewId = createReview("그대로", "제목과 내용은 그대로 두는 후기입니다.", "[\"SPRING\"]");

        mockMvc.perform(patch(REVIEWS_URL + "/" + reviewId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"seasonCodes\":[\"SUMMER\"]}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.title").value("그대로"))
                .andExpect(jsonPath("$.content").value("제목과 내용은 그대로 두는 후기입니다."))
                .andExpect(jsonPath("$.seasonCodes[0]").value("SUMMER"));
    }

    /**
     * 계절을 보내지 않으면 그대로 두고, 응답에는 지금 계절이 담깁니다.
     */
    @Test
    void keepsSeasonsWhenNotSentAndStillEchoesThem() throws Exception {
        long reviewId = createReview("제목만", "계절은 건드리지 않는 후기입니다.", "[\"SPRING\",\"AUTUMN\"]");

        mockMvc.perform(patch(REVIEWS_URL + "/" + reviewId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"title\":\"제목만 바꿈\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.seasonCodes[0]").value("SPRING"))
                .andExpect(jsonPath("$.seasonCodes[1]").value("AUTUMN"));
    }

    /**
     * <b>이 변경이 생긴 이유입니다.</b> 계절이 잘못되면 제목도 저장되지 않아야 합니다.
     *
     * <p>둘로 나뉘어 있던 시절에는 제목이 먼저 저장된 뒤 계절이 실패해, 서버에는 새 제목이
     * 있는데 화면은 "아무것도 저장 안 됨"으로 보이는 어긋남이 생겼습니다. 사용자는 포기하고
     * 떠나고, 새로고침해야 그제야 바뀐 제목이 나타납니다.
     */
    @Test
    void rollsBackTitleWhenSeasonCodeIsInvalid() throws Exception {
        long reviewId = createReview("원래 제목", "되돌아가야 하는 후기 내용입니다.", "[\"SPRING\"]");

        mockMvc.perform(patch(REVIEWS_URL + "/" + reviewId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"title":"바뀌면 안 되는 제목","seasonCodes":["NOPE"]}
                                """))
                .andExpect(status().isNotFound());

        assertThat(jdbcTemplate.queryForObject(
                "SELECT title FROM perfume_reviews WHERE id = ?", String.class, reviewId))
                .as("계절이 실패했으므로 제목도 원래대로여야 합니다")
                .isEqualTo("원래 제목");
        assertThat(jdbcTemplate.queryForList(
                "SELECT season_id FROM perfume_review_seasons WHERE review_id = ?",
                Long.class,
                reviewId
        )).containsExactly(1L);
    }

    /**
     * 비활성 계절도 같습니다. 있는 코드지만 쓸 수 없으므로 전부 되돌아갑니다.
     */
    @Test
    void rollsBackTitleWhenSeasonIsInactive() throws Exception {
        long reviewId = createReview("원래 제목", "비활성 계절로는 못 바꾸는 후기입니다.", "[\"SPRING\"]");

        mockMvc.perform(patch(REVIEWS_URL + "/" + reviewId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"title":"바뀌면 안 되는 제목","seasonCodes":["OLD"]}
                                """))
                .andExpect(status().isNotFound());

        assertThat(jdbcTemplate.queryForObject(
                "SELECT title FROM perfume_reviews WHERE id = ?", String.class, reviewId))
                .isEqualTo("원래 제목");
    }

    /**
     * 중복 계절은 400 이고, 이때도 제목은 그대로입니다.
     */
    @Test
    void rollsBackTitleWhenSeasonCodesAreDuplicated() throws Exception {
        long reviewId = createReview("원래 제목", "중복 계절로는 못 바꾸는 후기입니다.", "[\"SPRING\"]");

        mockMvc.perform(patch(REVIEWS_URL + "/" + reviewId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"title":"바뀌면 안 되는 제목","seasonCodes":["SUMMER","SUMMER"]}
                                """))
                .andExpect(status().isBadRequest());

        assertThat(jdbcTemplate.queryForObject(
                "SELECT title FROM perfume_reviews WHERE id = ?", String.class, reviewId))
                .isEqualTo("원래 제목");
    }

    /**
     * 빈 배열로는 계절을 비울 수 없습니다. 후기에는 계절이 적어도 하나 있어야 합니다 —
     * 계절 전용 엔드포인트와 같은 규칙입니다.
     */
    @Test
    void rejectsEmptySeasonCodes() throws Exception {
        long reviewId = createReview("원래 제목", "계절을 비울 수 없는 후기입니다.", "[\"SPRING\"]");

        mockMvc.perform(patch(REVIEWS_URL + "/" + reviewId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"title\":\"바뀌면 안 됨\",\"seasonCodes\":[]}"))
                .andExpect(status().isBadRequest());

        assertThat(jdbcTemplate.queryForObject(
                "SELECT title FROM perfume_reviews WHERE id = ?", String.class, reviewId))
                .isEqualTo("원래 제목");
    }

    @Test
    void replacesSeasonsAndKeepsExistingSummary() throws Exception {
        long reviewId = createReview("계절", "계절을 변경하기 위한 후기입니다.", "[\"SPRING\",\"SUMMER\"]");
        insertSummary();

        mockMvc.perform(put(REVIEWS_URL + "/" + reviewId + "/seasons")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"seasonCodes\":[\"AUTUMN\",\"WINTER\"]}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.seasonCodes[0]").value("AUTUMN"))
                .andExpect(jsonPath("$.seasonCodes[1]").value("WINTER"));

        assertThat(jdbcTemplate.queryForList(
                "SELECT season_id FROM perfume_review_seasons WHERE review_id = ? ORDER BY season_id",
                Long.class,
                reviewId
        )).containsExactly(3L, 4L);
        assertThat(count("perfume_review_summaries")).isOne();
    }

    @Test
    void deletesOwnReviewAndDependentDataWhileKeepingExistingSummary() throws Exception {
        long reviewId = createReview("삭제", "삭제할 향수 후기 내용입니다.", "[\"SPRING\",\"SUMMER\"]");
        insertSummary();

        mockMvc.perform(delete(REVIEWS_URL + "/" + reviewId))
                .andExpect(status().isNoContent());

        assertThat(count("perfume_reviews")).isZero();
        assertThat(count("perfume_review_seasons")).isZero();
        assertThat(count("perfume_review_summaries")).isOne();
        assertThat(count("perfumes")).isEqualTo(2);
    }

    /**
     * 계절 교체도 작성과 같은 기준으로 거릅니다.
     *
     * <p>작성만 막고 교체를 열어 두면, 제대로 쓴 뒤 교체로 없는 계절을 넣을 수 있습니다. 두
     * 경로가 같은 {@code toSeasonIds} 를 쓰지만 부르는 자리가 달라 따로 확인합니다.
     *
     * <p><b>거절된 뒤에도 원래 계절이 그대로 있어야 합니다.</b> 교체는 지우고 다시 넣는 순서라,
     * 검증이 지우기보다 늦으면 거절해 놓고 계절이 비어 버립니다.
     */
    @Test
    void rejectsBadSeasonCodesOnReplaceAndKeepsExisting() throws Exception {
        long reviewId = createReview("계절 교체", "계절을 잘못 바꾸려는 후기입니다.", "[\"SPRING\"]");

        mockMvc.perform(put(REVIEWS_URL + "/" + reviewId + "/seasons")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"seasonCodes\":[\"NOT_A_SEASON\"]}"))
                .andExpect(status().isNotFound());

        mockMvc.perform(put(REVIEWS_URL + "/" + reviewId + "/seasons")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"seasonCodes\":[\"OLD\"]}"))
                .andExpect(status().isNotFound());

        mockMvc.perform(put(REVIEWS_URL + "/" + reviewId + "/seasons")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"seasonCodes\":[\"SUMMER\",\"SUMMER\"]}"))
                .andExpect(status().isBadRequest());

        mockMvc.perform(get(REVIEWS_URL + "/" + reviewId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.seasons.length()").value(1))
                .andExpect(jsonPath("$.seasons[0].code").value("SPRING"));
    }

    @Test
    void protectsReviewMutationsByLoginAndOwner() throws Exception {
        long reviewId = createReview("비공개 변경", "작성자만 변경할 수 있는 후기입니다.", "[\"SPRING\"]");

        fakeCurrentUser.login(2L);
        mockMvc.perform(patch(REVIEWS_URL + "/" + reviewId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"title\":\"침범\"}"))
                .andExpect(status().isNotFound());
        mockMvc.perform(delete(REVIEWS_URL + "/" + reviewId))
                .andExpect(status().isNotFound());
        mockMvc.perform(put(REVIEWS_URL + "/" + reviewId + "/seasons")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"seasonCodes\":[\"SUMMER\"]}"))
                .andExpect(status().isNotFound());

        fakeCurrentUser.logout();
        mockMvc.perform(post(PERFUME_REVIEWS_URL)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(reviewBody("제목", "충분히 긴 후기 내용입니다.", "[\"SPRING\"]")))
                .andExpect(status().isUnauthorized());
        mockMvc.perform(delete(REVIEWS_URL + "/" + reviewId))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void returnsNotFoundForInactiveOrMissingPerfume() throws Exception {
        mockMvc.perform(get("/api/v1/perfumes/2/reviews"))
                .andExpect(status().isNotFound());
        mockMvc.perform(get("/api/v1/perfumes/99/reviews"))
                .andExpect(status().isNotFound());
        mockMvc.perform(post("/api/v1/perfumes/2/reviews")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(reviewBody("제목", "충분히 긴 후기 내용입니다.", "[\"SPRING\"]")))
                .andExpect(status().isNotFound());
    }

    @Test
    void documentsAllReviewEndpoints() throws Exception {
        mockMvc.perform(get("/v3/api-docs"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.paths['/api/v1/perfumes/{perfumeId}/reviews'].get").exists())
                .andExpect(jsonPath("$.paths['/api/v1/perfumes/{perfumeId}/reviews'].post").exists())
                .andExpect(jsonPath("$.paths['/api/v1/reviews/{reviewId}'].patch").exists())
                .andExpect(jsonPath("$.paths['/api/v1/reviews/{reviewId}'].delete").exists())
                .andExpect(jsonPath("$.paths['/api/v1/reviews/{reviewId}/seasons'].put").exists());
    }

    private long createReview(String title, String content, String seasonCodes) throws Exception {
        MvcResult result = mockMvc.perform(post(PERFUME_REVIEWS_URL)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(reviewBody(title, content, seasonCodes)))
                .andExpect(status().isCreated())
                .andReturn();
        JsonNode response = objectMapper.readTree(result.getResponse().getContentAsString());
        return response.get("reviewId").asLong();
    }

    private String reviewBody(String title, String content, String seasonCodes) throws Exception {
        return objectMapper.writeValueAsString(new ReviewBody(
                title,
                content,
                objectMapper.readValue(seasonCodes, String[].class)
        ));
    }

    private void insertSummary() {
        jdbcTemplate.update("""
                INSERT INTO perfume_review_summaries
                    (perfume_id, summary_text, source_review_count)
                VALUES (1, '기존 요약', 1)
                """);
    }

    private long count(String table) {
        return jdbcTemplate.queryForObject("SELECT COUNT(*) FROM " + table, Long.class);
    }

    private record ReviewBody(String title, String content, String[] seasonCodes) {
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

        private Long userId;

        void login(Long userId) {
            this.userId = userId;
        }

        void logout() {
            userId = null;
        }

        @Override
        public Optional<Long> id() {
            return Optional.ofNullable(userId);
        }
    }
}
