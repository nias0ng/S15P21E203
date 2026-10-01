package com.hyanghae.backend.perfume;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.hyanghae.backend.perfume.exception.PerfumeErrorCode;
import com.hyanghae.backend.support.IntegrationTest;
import org.hamcrest.Matchers;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;

/**
 * 주변 향수와 유사 향수 조회를 실제 PostgreSQL 위에서 검증합니다.
 *
 * <p>향 지도 향수에서 두 API 는 같은 {@code perfume_neighbors} 데이터를 같은 형태로 내려줍니다.
 * 그래서 동작 검증을 두 URL 에 대해 함께 돌립니다. 한쪽만 고치면 바로 실패합니다.
 *
 * <p>지도 밖 향수(이웃이 없는 향수)에서만 갈립니다. 유사 향수는 {@code perfume_similars} 를 읽고
 * 주변 향수는 빈 목록입니다. 아래 '지도 밖' 테스트들이 그 갈림을 봅니다.
 *
 * <p>기준 향수 1 의 연관 향수로 2, 3, 4, 6 을 넣어 두었고 4 는 비활성입니다. 따라서 정상 응답은
 * 2, 3, 6 세 건입니다.
 */
@IntegrationTest
@AutoConfigureMockMvc
class PerfumeRelatedPerfumesIntegrationTest {

    private static final String NEIGHBORS_URL = "/api/v1/perfumes/{perfumeId}/neighbors";
    private static final String SIMILAR_URL = "/api/v1/perfumes/{perfumeId}/similar";

    private static final String MAIN_IMAGE = "https://img.example.com/2-main.jpg";
    private static final String SUB_IMAGE = "https://img.example.com/2-sub.jpg";

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @BeforeEach
    void insertFixtures() {
        clearData();

        insertBrand(1, "Chanel");
        insertPerfume(1, "Base Scent", true);
        insertPerfume(2, "Related With Images", true);
        insertPerfume(3, "Related Without Image", true);
        insertPerfume(4, "Retired Related", false);
        insertPerfume(5, "Lonely Scent", true);
        insertPerfume(6, "Farther Related", true);

        // display_order 가 작은 쪽이 대표 이미지입니다. 일부러 큰 값을 먼저 넣습니다.
        insertImage(10, 2, SUB_IMAGE, 2);
        insertImage(11, 2, MAIN_IMAGE, 1);

        // 닮은 순서는 6, 3, 2 입니다. 향수 번호순(2, 3, 6)과 일부러 다르게 두었습니다.
        insertNeighbor(1, 6, 1);
        insertNeighbor(1, 3, 2);
        insertNeighbor(1, 2, 3);
        insertNeighbor(1, 4, 4);
    }

    @AfterEach
    void cleanUp() {
        clearData();
    }

    /** 두 API 가 같은 데이터를 쓴다는 것이 이 기능의 전제입니다. 응답 본문이 완전히 같아야 합니다. */
    @Test
    void neighborsAndSimilarReturnTheSameBody() throws Exception {
        String neighbors = mockMvc.perform(get(NEIGHBORS_URL, 1))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        String similar = mockMvc.perform(get(SIMILAR_URL, 1))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();

        assertEquals(neighbors, similar);
    }

    /** 비활성 향수 4 는 빠지고, 순서는 적재된 닮은 순서를 따릅니다. */
    @ParameterizedTest
    @ValueSource(strings = {NEIGHBORS_URL, SIMILAR_URL})
    void returnsActiveRelatedPerfumesOrderedByRank(String url) throws Exception {
        mockMvc.perform(get(url, 1))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.perfumes", Matchers.hasSize(3)))
                .andExpect(jsonPath("$.perfumes[0].perfumeId").value(6))
                .andExpect(jsonPath("$.perfumes[1].perfumeId").value(3))
                .andExpect(jsonPath("$.perfumes[2].perfumeId").value(2))
                .andExpect(jsonPath("$.perfumes[1].name").value("Related Without Image"));
    }

    /** rank 가 비어 있는 이웃은 뒤로 밀립니다. 적재가 일부만 순서를 채워도 앞을 어지럽히지 않습니다. */
    @ParameterizedTest
    @ValueSource(strings = {NEIGHBORS_URL, SIMILAR_URL})
    void putsNeighborWithoutRankLast(String url) throws Exception {
        insertPerfume(7, "Unranked Related", true);
        insertNeighbor(1, 7, null);

        mockMvc.perform(get(url, 1))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.perfumes", Matchers.hasSize(4)))
                .andExpect(jsonPath("$.perfumes[3].perfumeId").value(7));
    }

    /** 검색과 같은 규칙으로 display_order 가 작은 이미지가 대표입니다. 향수 2 는 세 번째입니다. */
    @ParameterizedTest
    @ValueSource(strings = {NEIGHBORS_URL, SIMILAR_URL})
    void picksThumbnailByDisplayOrder(String url) throws Exception {
        mockMvc.perform(get(url, 1))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.perfumes[2].imageUrl").value(MAIN_IMAGE));
    }

    @ParameterizedTest
    @ValueSource(strings = {NEIGHBORS_URL, SIMILAR_URL})
    void returnsNullImageUrlWhenRelatedPerfumeHasNoImage(String url) throws Exception {
        mockMvc.perform(get(url, 1))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.perfumes[1].imageUrl").doesNotExist());
    }

    /** 두 API 의 명세 응답에는 브랜드명이 없습니다. 검색 결과와 다른 점입니다. */
    @ParameterizedTest
    @ValueSource(strings = {NEIGHBORS_URL, SIMILAR_URL})
    void omitsBrandName(String url) throws Exception {
        mockMvc.perform(get(url, 1))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.perfumes[0].brandName").doesNotExist());
    }

    /** size 는 페이지 크기가 아니라 앞에서 몇 개까지 줄지입니다. */
    @ParameterizedTest
    @ValueSource(strings = {NEIGHBORS_URL, SIMILAR_URL})
    void limitsResultToRequestedSize(String url) throws Exception {
        mockMvc.perform(get(url, 1).param("size", "2"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.perfumes", Matchers.hasSize(2)))
                .andExpect(jsonPath("$.perfumes[0].perfumeId").value(6))
                .andExpect(jsonPath("$.perfumes[1].perfumeId").value(3));
    }

    /** 0 이하의 size 로 500 이 나면 안 됩니다. 목록 길이는 거절할 만한 값이 아닙니다. */
    @ParameterizedTest
    @ValueSource(strings = {NEIGHBORS_URL, SIMILAR_URL})
    void clampsSizeBelowOneInsteadOfFailing(String url) throws Exception {
        mockMvc.perform(get(url, 1).param("size", "0"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.perfumes", Matchers.hasSize(1)));
    }

    @ParameterizedTest
    @ValueSource(strings = {NEIGHBORS_URL, SIMILAR_URL})
    void capsOversizedRequestInsteadOfFailing(String url) throws Exception {
        mockMvc.perform(get(url, 1).param("size", "100000"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.perfumes", Matchers.hasSize(3)));
    }

    @ParameterizedTest
    @ValueSource(strings = {NEIGHBORS_URL, SIMILAR_URL})
    void returnsEmptyListWhenPerfumeHasNoRelatedPerfume(String url) throws Exception {
        mockMvc.perform(get(url, 5))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.perfumes", Matchers.hasSize(0)));
    }

    /**
     * 지도 밖 향수는 유사 향수가 미리 계산한 목록을 줍니다. 이웃만 읽던 때는 지도 밖 12.9만 개의
     * 상세에서 '비슷한 향수' 가 통째로 비었습니다(지인 피드백 F3 · F16).
     */
    @Test
    void similarFallsBackToPrecomputedListOutsideMap() throws Exception {
        insertSimilar(5, 3, "0.7000", 1);
        insertSimilar(5, 4, "0.6500", 2);
        insertSimilar(5, 6, "0.6000", 3);

        mockMvc.perform(get(SIMILAR_URL, 5))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.perfumes", Matchers.hasSize(2)))
                .andExpect(jsonPath("$.perfumes[0].perfumeId").value(3))
                .andExpect(jsonPath("$.perfumes[1].perfumeId").value(6));
    }

    /** 주변 향수는 지도의 이웃만 봅니다. 지도에 없는 향수가 '주변' 으로 나오면 안 됩니다. */
    @Test
    void neighborsIgnorePrecomputedListOutsideMap() throws Exception {
        insertSimilar(5, 3, "0.7000", 1);

        mockMvc.perform(get(NEIGHBORS_URL, 5))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.perfumes", Matchers.hasSize(0)));
    }

    /**
     * 지도 향수는 미리 계산한 목록이 있어도 이웃을 줍니다. 3D 지도가 그리는 선과 화면의 목록이
     * 같아야 합니다.
     */
    @Test
    void similarPrefersMapNeighbors() throws Exception {
        insertSimilar(1, 5, "0.9000", 1);

        mockMvc.perform(get(SIMILAR_URL, 1))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.perfumes[*].perfumeId", Matchers.contains(6, 3, 2)));
    }

    /** 미리 계산한 목록도 size 로 앞에서부터 자릅니다. */
    @Test
    void limitsPrecomputedListToRequestedSize() throws Exception {
        insertSimilar(5, 3, "0.7000", 1);
        insertSimilar(5, 6, "0.6000", 2);

        mockMvc.perform(get(SIMILAR_URL, 5).param("size", "1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.perfumes[*].perfumeId", Matchers.contains(3)));
    }

    /** 연관 관계는 방향이 있습니다. 1 의 목록에 2 가 있어도 2 의 목록에 1 이 있는 것은 아닙니다. */
    @ParameterizedTest
    @ValueSource(strings = {NEIGHBORS_URL, SIMILAR_URL})
    void doesNotAssumeRelationsAreMutual(String url) throws Exception {
        mockMvc.perform(get(url, 2))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.perfumes", Matchers.hasSize(0)));
    }

    /**
     * 숫자로 읽을 수 없는 {@code size} 는 400 입니다. 범위를 벗어난 값(0, 100000)은 목록 길이라
     * 보고 허용 범위로 맞추지만, 아예 숫자가 아닌 값은 요청이 잘못된 것입니다. 조용히 기본값으로
     * 넘어가면 화면이 왜 20개만 오는지 알 수 없습니다.
     *
     * <p>응답 본문이 Spring 기본 형식이 아니라 우리 {@code ApiErrorResponse} 형식인지도 함께
     * 확인합니다. 프론트가 모든 오류를 같은 모양으로 읽습니다.
     */
    @ParameterizedTest
    @ValueSource(strings = {NEIGHBORS_URL, SIMILAR_URL})
    void rejectsNonNumericSize(String url) throws Exception {
        mockMvc.perform(get(url, 1).param("size", "abc"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("BAD_REQUEST"))
                .andExpect(jsonPath("$.message").exists());
    }

    @ParameterizedTest
    @ValueSource(strings = {NEIGHBORS_URL, SIMILAR_URL})
    void returnsNotFoundWhenPerfumeDoesNotExist(String url) throws Exception {
        mockMvc.perform(get(url, 999))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value(PerfumeErrorCode.PERFUME_NOT_FOUND.code()));
    }

    @ParameterizedTest
    @ValueSource(strings = {NEIGHBORS_URL, SIMILAR_URL})
    void returnsNotFoundForInactivePerfume(String url) throws Exception {
        mockMvc.perform(get(url, 4))
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

    private void insertImage(long id, long perfumeId, String imageUrl, Integer displayOrder) {
        jdbcTemplate.update(
                "INSERT INTO perfume_images (image_id, perfume_id, image_url, display_order)"
                        + " VALUES (?, ?, ?, ?)",
                id, perfumeId, imageUrl, displayOrder);
    }

    private void insertNeighbor(long perfumeId, long neighborPerfumeId, Integer rank) {
        jdbcTemplate.update(
                "INSERT INTO perfume_neighbors (perfume_id, neighbor_perfume_id, rank)"
                        + " VALUES (?, ?, ?)",
                perfumeId, neighborPerfumeId, rank);
    }

    private void insertSimilar(long perfumeId, long similarPerfumeId, String similarity, int rank) {
        jdbcTemplate.update(
                "INSERT INTO perfume_similars (perfume_id, similar_perfume_id, similarity, rank)"
                        + " VALUES (?, ?, ?::numeric, ?)",
                perfumeId, similarPerfumeId, similarity, rank);
    }

    private void clearData() {
        jdbcTemplate.update("DELETE FROM perfume_similars");
        jdbcTemplate.update("DELETE FROM perfume_neighbors");
        jdbcTemplate.update("DELETE FROM perfume_images");
        jdbcTemplate.update("DELETE FROM perfumes");
        jdbcTemplate.update("DELETE FROM brands");
    }
}
