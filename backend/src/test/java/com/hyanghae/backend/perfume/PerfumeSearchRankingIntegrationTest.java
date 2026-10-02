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
 * 필요 없고, 누가 담았는지도 결과에 영향을 주지 않습니다.
 *
 * <p>보유·위시는 세 명 이상이 담은 향수만 나옵니다. 조회는 하한이 없습니다.
 */
@IntegrationTest
@AutoConfigureMockMvc
class PerfumeSearchRankingIntegrationTest {

    private static final String SEARCH_URL = "/api/v1/perfumes";

    private static final long[] USERS = {1L, 2L, 3L, 4L};

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    /**
     * 담은 사람 수를 일부러 향수 번호와 거꾸로 줍니다. 번호순으로 정렬하면 틀린 답이 나오므로
     * 담긴 수로 정렬하는지가 실제로 검증됩니다.
     *
     * <pre>
     * OWNED   5번 4명 · 1번 3명 · 9번 3명   → 통과 (8번 2명, 4번 0명, 7번 0명은 탈락)
     * WISH    2번 3명                        → 통과
     * VIEWED  3번 3회(2명) · 7번 1회(1명)     → 하한 없음
     * </pre>
     */
    @BeforeEach
    void insertFixtures() {
        clearData();

        insertUser(1, "one@example.com", "one");
        insertUser(2, "two@example.com", "two");
        insertUser(3, "three@example.com", "three");
        insertUser(4, "four@example.com", "four");

        insertBrand(1, "Chanel");
        insertBrand(2, "Diptyque");

        insertPerfume(1, 1, "Owned By Three", true);
        insertPerfume(2, 1, "Wished By Three", true);
        insertPerfume(3, 2, "Viewed By Two", true);
        insertPerfume(4, 1, "Removed From Shelf", true);
        insertPerfume(5, 1, "Owned By Four", true);
        insertPerfume(6, 1, "Inactive But Owned", false);
        insertPerfume(7, 2, "Only Viewed Once", true);
        insertPerfume(8, 1, "Barely Owned", true);
        insertPerfume(9, 2, "Also Owned By Three", true);

        // 기준을 넘는 향수들. 5번이 4명으로 가장 많고, 1번과 9번이 3명으로 동점입니다.
        saveBy(5, 1, 2, 3, 4);
        saveBy(1, 1, 2, 3);
        saveBy(9, 1, 2, 3);

        // 기준에 못 미치는 향수. 두 명뿐이라 결과에서 빠져야 합니다.
        saveBy(8, 1, 2);

        // 담겨 있지만 비활성이라 빠집니다. 기준 자체는 넘깁니다.
        saveBy(6, 1, 2, 3);

        // 진열대에서 뺀 향수입니다. 해제는 행을 물리 삭제합니다.
        saveBy(4, 1, 2, 3);
        jdbcTemplate.update("DELETE FROM user_perfumes WHERE perfume_id = 4");

        wishBy(2, 1, 2, 3);

        // 조회는 하한이 없습니다. 3번은 두 사람이 세 번, 7번은 한 사람이 한 번 봤습니다.
        insertView(200, 1, 3);
        insertView(201, 1, 3);
        insertView(202, 2, 3);
        insertView(203, 1, 7);
    }

    /** 여러 사람이 같은 향수를 보유로 담습니다. 진열대 항목 번호는 겹치지 않게 만듭니다. */
    private void saveBy(long perfumeId, long... userIds) {
        for (long userId : userIds) {
            insertShelfEntry(perfumeId * 100 + userId, userId, perfumeId, "OWNED");
        }
    }

    private void wishBy(long perfumeId, long... userIds) {
        for (long userId : userIds) {
            insertShelfEntry(perfumeId * 100 + userId, userId, perfumeId, "WISH");
        }
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

    /** 누가 담았는지는 상관없습니다. 여러 사람이 담은 향수가 담긴 수 순으로 함께 나옵니다. */
    @Test
    void includesPerfumesOwnedByAnyUser() throws Exception {
        mockMvc.perform(get(SEARCH_URL).param("ranking", "OWNED"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.perfumes", Matchers.hasSize(3)))
                .andExpect(jsonPath("$.perfumes[0].perfumeId").value(5))
                .andExpect(jsonPath("$.perfumes[1].perfumeId").value(1))
                .andExpect(jsonPath("$.perfumes[2].perfumeId").value(9));
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
                .andExpect(jsonPath("$.perfumes", Matchers.hasSize(2)))
                .andExpect(jsonPath("$.perfumes[0].perfumeId").value(3))
                .andExpect(jsonPath("$.totalElements").value(2));
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
        // keyword: 일반 검색은 이름에 Owned 가 든 활성 향수 1·5·8·9 를 찾습니다. 그중 기준을
        // 넘는 것은 1·5·9 이고 8 번은 두 명뿐이라 빠집니다. 하한이 두 경로에서 갈리는 지점입니다.
        assertPlainSearchFinds("keyword", "Owned", 1, 5, 8, 9);
        assertRankingFinds("keyword", "Owned", 1, 5, 9);

        // brand: 일반 검색은 Chanel 의 활성 향수 1·2·4·5·8, 그중 기준을 넘는 것은 1·5 입니다.
        assertPlainSearchFinds("brand", "Chanel", 1, 2, 4, 5, 8);
        assertRankingFinds("brand", "Chanel", 1, 5);

        // 조건에 걸리는 향수가 없으면 두 경로 모두 빈 목록입니다.
        assertPlainSearchFinds("keyword", "NoSuchPerfume");
        assertRankingFinds("keyword", "NoSuchPerfume");

        // 낱말마다 보는 길: 순서를 바꿔 친 'Three Owned' 는 통째로는 안 걸리고 낱말로 1·9 를 찾습니다.
        assertPlainSearchFinds("keyword", "Three Owned", 1, 9);
        assertRankingFinds("keyword", "Three Owned", 1, 9);

        // 브랜드와 이름을 같이 친 말: Chanel 이면서 Owned 가 든 1·5·8, 그중 기준을 넘는 것은 1·5 입니다.
        assertPlainSearchFinds("keyword", "Chanel Owned", 1, 5, 8);
        assertRankingFinds("keyword", "Chanel Owned", 1, 5);
    }

    /** 전체 개수도 목록과 같은 조건을 봐야 합니다. 어긋나면 마지막 페이지가 빕니다. */
    @Test
    void countsWithTheSameConditionAsTheList() throws Exception {
        mockMvc.perform(get(SEARCH_URL).param("ranking", "OWNED").param("keyword", "Owned").param("size", "1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.perfumes", Matchers.hasSize(1)))
                .andExpect(jsonPath("$.totalElements").value(3));
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
     * 담긴 수가 기준에 못 미치는 향수는 나오지 않습니다.
     *
     * <p>8번은 두 사람이 담았습니다. 한 명만 더 담으면 나와야 하므로 이 단언이 하한을 실제로
     * 지킵니다. 하한을 지우면 8번이 목록에 섞여 들어와 여기서 먼저 깨집니다.
     */
    @Test
    void excludesPerfumeBelowMinimumSaveCount() throws Exception {
        mockMvc.perform(get(SEARCH_URL).param("ranking", "OWNED"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.perfumes[*].perfumeId", Matchers.not(Matchers.hasItem(8))));

        insertShelfEntry(899, USERS[2], 8, "OWNED");

        mockMvc.perform(get(SEARCH_URL).param("ranking", "OWNED"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.perfumes[*].perfumeId", Matchers.hasItem(8)));
    }

    /**
     * 많이 담긴 향수가 앞에 옵니다.
     *
     * <p>담긴 수와 향수 번호가 거꾸로 가도록 짰습니다. 5번을 네 사람이, 1번을 세 사람이
     * 담았습니다. 번호순으로 정렬하면 1번이 앞이라 틀린 답이 나옵니다.
     */
    @Test
    void ordersBySaveCountDescending() throws Exception {
        mockMvc.perform(get(SEARCH_URL).param("ranking", "OWNED"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.perfumes", Matchers.hasSize(3)))
                .andExpect(jsonPath("$.perfumes[0].perfumeId").value(5))
                .andExpect(jsonPath("$.perfumes[1].perfumeId").value(1))
                .andExpect(jsonPath("$.perfumes[2].perfumeId").value(9));
    }

    /**
     * 같은 수면 향수 번호순입니다. 순서를 확정하지 않으면 같은 요청이 매번 다른 답을 주어,
     * 2페이지에 1페이지 항목이 다시 나옵니다. 1번과 9번이 각각 세 사람으로 동점입니다.
     */
    @Test
    void breaksTieByPerfumeId() throws Exception {
        mockMvc.perform(get(SEARCH_URL).param("ranking", "OWNED"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.perfumes[1].perfumeId").value(1))
                .andExpect(jsonPath("$.perfumes[2].perfumeId").value(9));
    }

    /** 페이지를 넘겨도 인기순이 이어집니다. */
    @Test
    void keepsSaveCountOrderAcrossPages() throws Exception {
        mockMvc.perform(get(SEARCH_URL).param("ranking", "OWNED").param("page", "0").param("size", "1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.perfumes", Matchers.hasSize(1)))
                .andExpect(jsonPath("$.perfumes[0].perfumeId").value(5))
                .andExpect(jsonPath("$.totalElements").value(3));

        mockMvc.perform(get(SEARCH_URL).param("ranking", "OWNED").param("page", "1").param("size", "1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.perfumes", Matchers.hasSize(1)))
                .andExpect(jsonPath("$.perfumes[0].perfumeId").value(1))
                .andExpect(jsonPath("$.totalElements").value(3));
    }

    /** 마지막 페이지를 넘겨 요청하면 오류가 아니라 빈 목록입니다. */
    @Test
    void returnsEmptyPageBeyondTheLastPage() throws Exception {
        mockMvc.perform(get(SEARCH_URL).param("ranking", "OWNED").param("page", "10"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.perfumes", Matchers.hasSize(0)))
                .andExpect(jsonPath("$.totalElements").value(3));
    }

    /** 다른 정렬을 요청해도 인기순입니다. {@code ranking} 에는 다른 정렬이 없습니다. */
    @Test
    void ignoresRequestedSort() throws Exception {
        mockMvc.perform(get(SEARCH_URL).param("ranking", "OWNED").param("sort", "id,asc"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.perfumes[0].perfumeId").value(5))
                .andExpect(jsonPath("$.perfumes[1].perfumeId").value(1));
    }

    /**
     * 조회 이력도 많이 열어 본 순입니다.
     *
     * <p>조회에는 하한이 없습니다. 7번은 한 사람이 한 번 봤을 뿐인데도 나옵니다. 보유·위시였다면
     * 세 명 기준에 걸려 빠졌을 향수입니다.
     */
    @Test
    void ordersViewedByViewCount() throws Exception {
        mockMvc.perform(get(SEARCH_URL).param("ranking", "VIEWED"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.perfumes", Matchers.hasSize(2)))
                .andExpect(jsonPath("$.perfumes[0].perfumeId").value(3))
                .andExpect(jsonPath("$.perfumes[1].perfumeId").value(7));
    }

    @Test
    void combinesRankingWithBrandUsingAnd() throws Exception {
        // Chanel 이면서 기준을 넘는 것은 5번·1번입니다. 9번은 Diptyque 라 빠집니다.
        mockMvc.perform(get(SEARCH_URL).param("ranking", "OWNED").param("brand", "Chanel"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.perfumes", Matchers.hasSize(2)))
                .andExpect(jsonPath("$.perfumes[0].perfumeId").value(5))
                .andExpect(jsonPath("$.perfumes[1].perfumeId").value(1));
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
