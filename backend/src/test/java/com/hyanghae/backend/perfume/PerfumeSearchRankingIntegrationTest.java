package com.hyanghae.backend.perfume;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.hyanghae.backend.support.IntegrationTest;
import org.hamcrest.Matchers;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;

/**
 * 검색의 인기순 정렬(ranking)을 실제 PostgreSQL 위에서 검증합니다.
 *
 * <p>전체 사용자 집계 기준입니다. "내가 담은 향수"가 아니라 "사람들이 담은 향수"라서 로그인이
 * 필요 없고, 누가 담았는지도 결과에 영향을 주지 않습니다. 사용자 1 과 2 가 서로 다른 향수를
 * 담아 두었고, 둘 다 결과에 나와야 합니다.
 */
@IntegrationTest
@AutoConfigureMockMvc
class PerfumeSearchRankingIntegrationTest {

    private static final String SEARCH_URL = "/api/v1/perfumes";

    private static final long USER_ONE = 1L;
    private static final long USER_TWO = 2L;
    private static final long USER_THREE = 3L;

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @BeforeEach
    void insertFixtures() {
        clearData();

        insertUser(USER_ONE, "one@example.com", "one");
        insertUser(USER_TWO, "two@example.com", "two");

        insertBrand(1, "Chanel");
        insertBrand(2, "Diptyque");

        insertPerfume(1, 1, "Owned By One", true);
        insertPerfume(2, 1, "Wished By One", true);
        insertPerfume(3, 2, "Viewed By One", true);
        insertPerfume(4, 1, "Removed From Shelf", true);
        insertPerfume(5, 1, "Owned By Two", true);
        insertPerfume(6, 1, "Inactive But Owned", false);
        insertPerfume(7, 2, "Nobody Touched", true);

        insertShelfEntry(100, USER_ONE, 1, "OWNED");
        insertShelfEntry(101, USER_ONE, 2, "WISH");
        insertShelfEntry(102, USER_ONE, 4, "OWNED");
        // 진열대 해제는 행을 물리 삭제합니다.
        jdbcTemplate.update("DELETE FROM user_perfumes WHERE user_perfumes_id = 102");
        insertShelfEntry(103, USER_TWO, 5, "OWNED");
        insertShelfEntry(104, USER_TWO, 6, "OWNED");

        // 같은 향수를 여러 사람이 여러 번 봤습니다. 결과에는 한 번만 나와야 합니다.
        insertView(200, USER_ONE, 3);
        insertView(201, USER_ONE, 3);
        insertView(202, USER_TWO, 3);
    }

    @AfterEach
    void cleanUp() {
        clearData();
    }

    /** 로그인 없이 쓸 수 있어야 합니다. 전체 사용자 집계라 요청자가 누구인지 볼 필요가 없습니다. */
    @Test
    void worksWithoutLogin() throws Exception {
        mockMvc.perform(get(SEARCH_URL).param("ranking", "OWNED"))
                .andExpect(status().isOk());
    }

    /** 누가 담았는지는 상관없습니다. 사용자 1 의 향수와 사용자 2 의 향수가 함께 나옵니다. */
    @Test
    void includesPerfumesOwnedByAnyUser() throws Exception {
        mockMvc.perform(get(SEARCH_URL).param("ranking", "OWNED"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.perfumes", Matchers.hasSize(2)))
                .andExpect(jsonPath("$.perfumes[0].perfumeId").value(1))
                .andExpect(jsonPath("$.perfumes[1].perfumeId").value(5));
    }

    /** ownership_status 조건을 빼면 위시로 담은 향수가 보유 결과에 섞입니다. */
    @Test
    void filtersByWish() throws Exception {
        mockMvc.perform(get(SEARCH_URL).param("ranking", "WISH"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.perfumes", Matchers.hasSize(1)))
                .andExpect(jsonPath("$.perfumes[0].perfumeId").value(2));
    }

    /**
     * 같은 향수를 여러 사람이 여러 번 봐도 응답에는 한 건입니다.
     *
     * <p>이 보장은 조회 기록을 {@code DISTINCT} 로 뽑기 때문이 아니라, 향수 목록 쿼리가 향수
     * 하나를 한 행으로 돌려주기 때문입니다. {@code DISTINCT} 를 지워도 이 단언은 통과합니다.
     */
    @Test
    void filtersByViewed() throws Exception {
        mockMvc.perform(get(SEARCH_URL).param("ranking", "VIEWED"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.perfumes", Matchers.hasSize(1)))
                .andExpect(jsonPath("$.perfumes[0].perfumeId").value(3))
                .andExpect(jsonPath("$.totalElements").value(1));
    }

    /**
     * 진열대에서 뺀 향수는 나오지 않습니다.
     *
     * <p>거르는 조건이 있어서가 아니라 해제가 행을 물리 삭제하기 때문입니다. 조건으로 막는 것이
     * 아니므로 이 테스트는 쿼리가 아니라 삭제 정책을 지킵니다. 나중에 다시 소프트 삭제로 돌아가면
     * 이 단언이 먼저 깨져서, 필터에 조건을 추가해야 한다는 것을 알려줍니다.
     */
    @Test
    void excludesPerfumeRemovedFromShelf() throws Exception {
        mockMvc.perform(get(SEARCH_URL).param("ranking", "OWNED"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.perfumes[*].perfumeId", Matchers.not(Matchers.hasItem(4))));
    }

    /** 담겨 있어도 비활성 향수는 나오지 않습니다. 다른 조회와 같은 기준입니다. */
    @Test
    void excludesInactivePerfume() throws Exception {
        mockMvc.perform(get(SEARCH_URL).param("ranking", "OWNED"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.perfumes[*].perfumeId", Matchers.not(Matchers.hasItem(6))));
    }

    /**
     * 아무도 담지 않은 향수는 나오지 않습니다.
     *
     * <p>0 건으로 뒤에 붙이지 않고 아예 뺍니다. 붙이면 카탈로그 전체가 향수 번호순으로 따라와,
     * 사용자가 적은 동안에는 그 꼬리가 목록의 대부분을 차지합니다.
     */
    @Test
    void excludesPerfumeNobodySaved() throws Exception {
        mockMvc.perform(get(SEARCH_URL).param("ranking", "OWNED"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.perfumes[*].perfumeId", Matchers.not(Matchers.hasItem(7))));
    }

    /**
     * 검색 조건이 두 경로에서 같게 동작하는지 확인합니다.
     *
     * <p>{@code ranking} 없는 검색은 JPQL, 있는 검색은 SQL 로 조건을 각각 적습니다. 집계를 파생
     * 테이블로 한 번만 계산해 조인해야 하는데 JPQL 로는 표현되지 않아 갈라진 것입니다. 한쪽만
     * 고치면 조용히 결과가 어긋나므로, 같은 조건을 두 경로에 태워 여기서 맞춰 봅니다.
     *
     * <p>{@code ranking} 결과는 언제나 "같은 조건의 일반 검색 결과 중 기록이 있는 것" 이어야 합니다.
     */
    @Test
    void appliesSameSearchConditionAsPlainSearch() throws Exception {
        // keyword: 일반 검색은 이름에 By 가 든 1·2·3·5 를 찾습니다. 그중 OWNED 기록이 있는 것은
        // 1·5 뿐입니다. 2 는 WISH, 3 은 조회 기록만 있습니다.
        assertPlainSearchFinds("keyword", "By", 1, 2, 3, 5);
        assertRankingFinds("keyword", "By", 1, 5);

        // brand: 일반 검색은 Chanel 의 활성 향수 1·2·4·5, 그중 OWNED 는 1·5 입니다.
        assertPlainSearchFinds("brand", "Chanel", 1, 2, 4, 5);
        assertRankingFinds("brand", "Chanel", 1, 5);

        // 조건에 걸리는 향수가 없으면 두 경로 모두 빈 목록입니다.
        assertPlainSearchFinds("keyword", "NoSuchPerfume");
        assertRankingFinds("keyword", "NoSuchPerfume");
    }

    /** 전체 개수도 목록과 같은 조건을 봐야 합니다. 어긋나면 마지막 페이지가 빕니다. */
    @Test
    void countsWithTheSameConditionAsTheList() throws Exception {
        mockMvc.perform(get(SEARCH_URL).param("ranking", "OWNED").param("keyword", "By").param("size", "1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.perfumes", Matchers.hasSize(1)))
                .andExpect(jsonPath("$.totalElements").value(2));
    }

    private void assertPlainSearchFinds(String param, String value, Integer... expected) throws Exception {
        mockMvc.perform(get(SEARCH_URL).param(param, value).param("size", "100"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.perfumes[*].perfumeId", Matchers.containsInAnyOrder(expected)));
    }

    private void assertRankingFinds(String param, String value, Integer... expected) throws Exception {
        mockMvc.perform(get(SEARCH_URL).param("ranking", "OWNED").param(param, value).param("size", "100"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.perfumes[*].perfumeId", Matchers.containsInAnyOrder(expected)));
    }

    /**
     * 많이 담긴 향수가 앞에 옵니다.
     *
     * <p>담긴 횟수와 향수 번호가 거꾸로 가도록 짰습니다. 1번을 세 사람이, 5번을 두 사람이,
     * 2번을 한 사람이 담았습니다. 2번은 번호가 5번보다 작은데도 뒤에 와야 하므로, 번호순으로
     * 정렬하면 틀린 답이 나옵니다.
     */
    @Test
    void ordersBySaveCountDescending() throws Exception {
        insertUser(USER_THREE, "three@example.com", "three");
        // 1번 = 3명(100, 110, 112), 5번 = 2명(103, 111), 2번 = 1명(113)
        insertShelfEntry(110, USER_TWO, 1, "OWNED");
        insertShelfEntry(111, USER_THREE, 5, "OWNED");
        insertShelfEntry(112, USER_THREE, 1, "OWNED");
        insertShelfEntry(113, USER_THREE, 2, "OWNED");

        mockMvc.perform(get(SEARCH_URL).param("ranking", "OWNED"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.perfumes", Matchers.hasSize(3)))
                .andExpect(jsonPath("$.perfumes[0].perfumeId").value(1))
                .andExpect(jsonPath("$.perfumes[1].perfumeId").value(5))
                .andExpect(jsonPath("$.perfumes[2].perfumeId").value(2));
    }

    /**
     * 같은 횟수면 향수 번호순입니다. 순서를 확정하지 않으면 같은 요청이 매번 다른 답을 주어,
     * 2페이지에 1페이지 항목이 다시 나옵니다.
     */
    @Test
    void breaksTieByPerfumeId() throws Exception {
        mockMvc.perform(get(SEARCH_URL).param("ranking", "OWNED"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.perfumes", Matchers.hasSize(2)))
                .andExpect(jsonPath("$.perfumes[0].perfumeId").value(1))
                .andExpect(jsonPath("$.perfumes[1].perfumeId").value(5));
    }

    /**
     * 페이지를 넘겨도 인기순이 이어집니다.
     *
     * <p>번호 목록을 자른 뒤 내용을 가져오는 구조라, 마지막에 순서를 다시 세우지 않으면 여기서
     * 조용히 번호순으로 바뀝니다.
     */
    @Test
    void keepsSaveCountOrderAcrossPages() throws Exception {
        insertUser(USER_THREE, "three@example.com", "three");
        insertShelfEntry(110, USER_TWO, 1, "OWNED");
        insertShelfEntry(111, USER_THREE, 1, "OWNED");
        insertShelfEntry(112, USER_THREE, 2, "OWNED");
        // 담긴 횟수: 1번 = 3, 2번 = 1(WISH 라 제외), 5번 = 1

        mockMvc.perform(get(SEARCH_URL).param("ranking", "OWNED").param("page", "0").param("size", "1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.perfumes", Matchers.hasSize(1)))
                .andExpect(jsonPath("$.perfumes[0].perfumeId").value(1))
                .andExpect(jsonPath("$.totalElements").value(3));

        mockMvc.perform(get(SEARCH_URL).param("ranking", "OWNED").param("page", "1").param("size", "1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.perfumes", Matchers.hasSize(1)))
                .andExpect(jsonPath("$.perfumes[0].perfumeId").value(2))
                .andExpect(jsonPath("$.totalElements").value(3));
    }

    /** 마지막 페이지를 넘겨 요청하면 오류가 아니라 빈 목록입니다. */
    @Test
    void returnsEmptyPageBeyondTheLastPage() throws Exception {
        mockMvc.perform(get(SEARCH_URL).param("ranking", "OWNED").param("page", "10"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.perfumes", Matchers.hasSize(0)))
                .andExpect(jsonPath("$.totalElements").value(2));
    }

    /** 다른 정렬을 요청해도 인기순입니다. 진열대 필터에는 다른 정렬이 없습니다. */
    @Test
    void ignoresRequestedSort() throws Exception {
        insertUser(USER_THREE, "three@example.com", "three");
        // 5번이 2명(103, 110), 1번이 1명(100)입니다. 번호순을 요청해도 5번이 앞에 와야 합니다.
        insertShelfEntry(110, USER_THREE, 5, "OWNED");

        mockMvc.perform(get(SEARCH_URL).param("ranking", "OWNED").param("sort", "id,asc"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.perfumes[0].perfumeId").value(5))
                .andExpect(jsonPath("$.perfumes[1].perfumeId").value(1));
    }

    /** 조회 이력도 많이 열어 본 순입니다. */
    @Test
    void ordersViewedByViewCount() throws Exception {
        // 3번은 픽스처에서 3회, 7번은 여기서 1회입니다.
        insertView(210, USER_ONE, 7);

        mockMvc.perform(get(SEARCH_URL).param("ranking", "VIEWED"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.perfumes", Matchers.hasSize(2)))
                .andExpect(jsonPath("$.perfumes[0].perfumeId").value(3))
                .andExpect(jsonPath("$.perfumes[1].perfumeId").value(7));
    }

    @Test
    void combinesShelfWithBrandUsingAnd() throws Exception {
        mockMvc.perform(get(SEARCH_URL).param("ranking", "OWNED").param("brand", "Chanel"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.perfumes", Matchers.hasSize(2)))
                .andExpect(jsonPath("$.perfumes[0].perfumeId").value(1))
                .andExpect(jsonPath("$.perfumes[1].perfumeId").value(5));
    }

    /** 담긴 향수가 없으면 IN 절에 넣을 값이 없습니다. SQL 오류가 아니라 빈 목록이어야 합니다. */
    @Test
    void returnsEmptyWhenNobodySavedAnything() throws Exception {
        jdbcTemplate.update("DELETE FROM user_perfumes");

        mockMvc.perform(get(SEARCH_URL).param("ranking", "OWNED"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.perfumes", Matchers.hasSize(0)))
                .andExpect(jsonPath("$.totalElements").value(0));
    }

    @Test
    void rejectsUnknownShelfValue() throws Exception {
        mockMvc.perform(get(SEARCH_URL).param("ranking", "BORROWED"))
                .andExpect(status().isBadRequest());
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

    private void insertPerfume(long id, long brandId, String name, boolean active) {
        jdbcTemplate.update(
                "INSERT INTO perfumes (perfume_id, brand_id, name, is_active) VALUES (?, ?, ?, ?)",
                id, brandId, name, active);
    }

    private void insertShelfEntry(long id, long userId, long perfumeId, String ownershipStatus) {
        jdbcTemplate.update(
                "INSERT INTO user_perfumes (user_perfumes_id, user_id, perfume_id, ownership_status)"
                        + " VALUES (?, ?, ?, ?)",
                id, userId, perfumeId, ownershipStatus);
    }

    private void insertView(long id, long userId, long perfumeId) {
        jdbcTemplate.update(
                "INSERT INTO user_perfume_views (perfume_view_id, user_id, perfume_id) VALUES (?, ?, ?)",
                id, userId, perfumeId);
    }

    private void clearData() {
        jdbcTemplate.update("DELETE FROM user_perfume_views");
        jdbcTemplate.update("DELETE FROM user_perfumes");
        jdbcTemplate.update("DELETE FROM perfumes");
        jdbcTemplate.update("DELETE FROM brands");
        jdbcTemplate.update("DELETE FROM users");
    }
}
