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

    /**
     * 순위가 200 을 넘어도 뒤집히지 않습니다.
     *
     * <p>{@code korea_selection_rank} 에는 <b>어떤 제약도 없습니다</b> — {@code INTEGER} 일
     * 뿐이라 200 초과도 들어갑니다. 지금은 적재가 1~200 만 넣지만 그건 데이터의 사정이지 표의
     * 약속이 아닙니다.
     *
     * <p>이 테스트는 순서가 맞는지만 봅니다. 뒤집는 방법({@code -rank} 인지 {@code 201 - rank}
     * 인지)은 구분하지 못합니다 — 둘 다 순위에 대해 단조감소라 결과가 같습니다. 방법을 고른
     * 이유는 저장소 주석에 적었습니다.
     */
    @Test
    void keepsOrderWhenRankExceedsTwoHundred() {
        insertPerfume(6, "Rank Five Hundred", 500, true);
        insertPerfume(7, "Rank Two Hundred One", 201, true);

        assertSelectionOrder(
                "First Pick",            // 1
                "Second Pick",           // 2
                "Third Pick",            // 3
                "Rank Two Hundred One",  // 201
                "Rank Five Hundred");    // 500
    }

    /**
     * 같은 순위가 여럿이어도 순서가 흔들리지 않습니다.
     *
     * <p>순위에 유니크 제약이 없어 적재가 실수하면 같은 값이 둘 생깁니다. 그때 순서가 매번
     * 달라지면 <b>페이지를 넘길 때 같은 향수가 다시 나오거나 아예 빠집니다.</b> 동점은 향수
     * 번호순으로 확정합니다.
     */
    @Test
    void breaksRankTiesByPerfumeId() {
        insertPerfume(6, "Also Rank One B", 1, true);
        insertPerfume(7, "Also Rank One C", 1, true);

        // 향수 2 가 순위 1 이고 6·7 도 순위 1 입니다. 번호가 작은 2 가 먼저입니다.
        assertSelectionOrder(
                "First Pick",       // 향수 2, 순위 1
                "Also Rank One B",  // 향수 6, 순위 1
                "Also Rank One C",  // 향수 7, 순위 1
                "Second Pick",      // 향수 3, 순위 2
                "Third Pick");      // 향수 1, 순위 3
    }

    /** 같은 요청을 두 번 보내도 같은 순서입니다. 동점이 있어도 그렇습니다. */
    @Test
    void repeatsTheSameOrder() throws Exception {
        insertPerfume(6, "Also Rank One B", 1, true);

        String first = fetchNames();
        String second = fetchNames();
        org.assertj.core.api.Assertions.assertThat(first).isEqualTo(second);
    }

    private void assertSelectionOrder(String... names) {
        try {
            var request = mockMvc.perform(get(SEARCH_URL).param("ranking", "POPULAR"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.perfumes.length()").value(names.length));
            for (int index = 0; index < names.length; index++) {
                request.andExpect(jsonPath("$.perfumes[" + index + "].name").value(names[index]));
            }
        } catch (Exception exception) {
            throw new IllegalStateException(exception);
        }
    }

    private String fetchNames() throws Exception {
        return mockMvc.perform(get(SEARCH_URL).param("ranking", "POPULAR"))
                .andReturn()
                .getResponse()
                .getContentAsString();
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
