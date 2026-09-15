package com.hyanghae.backend.perfume;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.hyanghae.backend.support.IntegrationTest;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;

/**
 * {@code ranking=POPULAR} 을 검증합니다. 국내 선정 순위 순입니다.
 *
 * <p>나머지 셋({@code OWNED}·{@code WISH}·{@code VIEWED})과 성격이 다릅니다 — 그쪽은 사용자
 * 기록이고 이것만 편집이 고른 목록입니다. 서비스 초기에 사용자 기록이 비어 있어도 인기 향수를
 * 띄울 수 있어야 해서 넣었습니다.
 *
 * <p>고정 데이터는 이렇습니다.
 *
 * <ul>
 *   <li>향수 1 순위 3 · 향수 2 순위 1 · 향수 3 순위 2 — <b>번호와 순위가 어긋나게</b> 두었습니다.
 *       번호순으로 나오면 통과하는 테스트가 되지 않게 하려는 것입니다.
 *   <li>향수 4 순위 없음 — 나오면 안 됩니다.
 *   <li>향수 5 순위 1 이지만 비활성 — 나오면 안 됩니다.
 * </ul>
 */
@IntegrationTest
@AutoConfigureMockMvc
class PerfumeSelectionRankingIntegrationTest {

    private static final String SEARCH_URL = "/api/v1/perfumes";

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @BeforeEach
    void insertFixtures() {
        clearData();

        jdbcTemplate.update(
                "INSERT INTO brands (brand_id, name, name_ko, is_active)"
                        + " VALUES (1, 'Chanel', '샤넬', true)");

        insertPerfume(1, "Third Pick", 3, true);
        insertPerfume(2, "First Pick", 1, true);
        insertPerfume(3, "Second Pick", 2, true);
        insertPerfume(4, "Not Selected", null, true);
        insertPerfume(5, "Selected But Inactive", 1, false);
    }

    @AfterEach
    void cleanUp() {
        clearData();
    }

    /**
     * 선정 순위가 <b>작은 것부터</b> 나옵니다.
     *
     * <p>바깥 쿼리가 {@code ORDER BY s.c DESC} 로 굳어 있어 순위를 음수로 뒤집어 넣었습니다.
     * 부호를 잘못 두면 200위가 먼저 나오는데, 고정 데이터의 번호와 순위를 어긋나게 두어 번호순
     * 우연으로 통과하지 않게 했습니다.
     */
    @Test
    void ordersBySelectionRankAscending() throws Exception {
        mockMvc.perform(get(SEARCH_URL).param("ranking", "POPULAR"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.perfumes.length()").value(3))
                .andExpect(jsonPath("$.perfumes[0].name").value("First Pick"))
                .andExpect(jsonPath("$.perfumes[1].name").value("Second Pick"))
                .andExpect(jsonPath("$.perfumes[2].name").value("Third Pick"));
    }

    /** 순위가 없는 향수는 빠집니다. 나머지 정렬이 기준 미달을 빼는 것과 같은 규칙입니다. */
    @Test
    void hidesPerfumesWithoutSelectionRank() throws Exception {
        mockMvc.perform(get(SEARCH_URL).param("ranking", "POPULAR"))
                .andExpect(jsonPath("$.perfumes[*].name").value(
                        org.hamcrest.Matchers.not(
                                org.hamcrest.Matchers.hasItem("Not Selected"))))
                .andExpect(jsonPath("$.totalElements").value(3));
    }

    /** 비활성 향수는 순위가 있어도 빠집니다. 검색·상세와 같은 기준입니다. */
    @Test
    void hidesInactivePerfume() throws Exception {
        mockMvc.perform(get(SEARCH_URL).param("ranking", "POPULAR"))
                .andExpect(jsonPath("$.perfumes[*].name").value(
                        org.hamcrest.Matchers.not(
                                org.hamcrest.Matchers.hasItem("Selected But Inactive"))));
    }

    /** 로그인이 필요 없습니다. 사용자 기록이 아니라 편집이 고른 목록입니다. */
    @Test
    void worksWithoutLogin() throws Exception {
        mockMvc.perform(get(SEARCH_URL).param("ranking", "POPULAR"))
                .andExpect(status().isOk());
    }

    /** 다른 조건과 함께 걸립니다. 인기 목록 안에서 브랜드로 다시 좁힐 수 있어야 합니다. */
    @Test
    void combinesWithOtherFilters() throws Exception {
        mockMvc.perform(get(SEARCH_URL).param("ranking", "POPULAR").param("brandId", "1"))
                .andExpect(jsonPath("$.perfumes.length()").value(3));

        mockMvc.perform(get(SEARCH_URL).param("ranking", "POPULAR").param("keyword", "First"))
                .andExpect(jsonPath("$.perfumes.length()").value(1))
                .andExpect(jsonPath("$.perfumes[0].name").value("First Pick"));
    }

    /** 브랜드 한국어 이름이 함께 나갑니다. 다른 정렬과 같은 카드를 그립니다. */
    @Test
    void carriesBrandKoreanName() throws Exception {
        mockMvc.perform(get(SEARCH_URL).param("ranking", "POPULAR"))
                .andExpect(jsonPath("$.perfumes[0].brandName").value("Chanel"))
                .andExpect(jsonPath("$.perfumes[0].brandNameKo").value("샤넬"));
    }

    /** 페이지가 걸립니다. 화면은 30개를 띄웁니다. */
    @Test
    void paginates() throws Exception {
        mockMvc.perform(get(SEARCH_URL).param("ranking", "POPULAR").param("size", "2"))
                .andExpect(jsonPath("$.perfumes.length()").value(2))
                .andExpect(jsonPath("$.perfumes[0].name").value("First Pick"))
                .andExpect(jsonPath("$.totalElements").value(3));

        mockMvc.perform(get(SEARCH_URL)
                        .param("ranking", "POPULAR").param("size", "2").param("page", "1"))
                .andExpect(jsonPath("$.perfumes.length()").value(1))
                .andExpect(jsonPath("$.perfumes[0].name").value("Third Pick"));
    }

    private void insertPerfume(long id, String name, Integer rank, boolean active) {
        jdbcTemplate.update("""
                INSERT INTO perfumes (perfume_id, brand_id, name, korea_selection_rank, is_active)
                VALUES (?, 1, ?, ?, ?)
                """, id, name, rank, active);
    }

    private void clearData() {
        jdbcTemplate.update("DELETE FROM perfumes");
        jdbcTemplate.update("DELETE FROM brands");
    }
}
