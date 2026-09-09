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
 * 검색의 브랜드·성별 필터를 실제 PostgreSQL 위에서 검증합니다.
 *
 * <p>검색어 자체의 동작은 {@link PerfumeSearchIntegrationTest} 가 봅니다. 여기서는 필터가 실제로
 * 조회에 반영되는지, 조건이 겹칠 때 AND 로 걸리는지, 조건 없는 파라미터가 무시되는지를 봅니다.
 *
 * <p>널 가능 파라미터를 JPQL 에 넣는 구조라 실행 순서를 타는 실패가 나기 쉽습니다. 같은 커넥션에서
 * 앞선 쿼리가 문자열을 바인딩해 두면 통과하고 단독 실행에서는 실패하는 식입니다. 그래서 각 조합을
 * 따로 두었고, 한 개씩 단독 실행해도 통과해야 합니다.
 */
@IntegrationTest
@AutoConfigureMockMvc
class PerfumeSearchFilterIntegrationTest {

    private static final String SEARCH_URL = "/api/v1/perfumes";

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @BeforeEach
    void insertFixtures() {
        clearData();

        insertBrand(1, "Chanel");
        insertBrand(2, "Diptyque");

        insertPerfume(1, 1, "Bleu de Chanel", "MALE", true);
        insertPerfume(2, 1, "Chance", "FEMALE", true);
        insertPerfume(3, 2, "Do Son", "UNISEX", true);
        insertPerfume(4, 1, "Retired Chanel", "MALE", false);
        insertPerfume(5, null, "Orphan Scent", null, true);
        // 수집 데이터가 다른 표기로 들어온 경우입니다. 어휘가 어긋나면 걸리지 않아야 합니다.
        insertPerfume(6, 2, "Lowercase Gender", "male", true);
    }

    @AfterEach
    void cleanUp() {
        clearData();
    }

    /** 브랜드 페이지에서 넘어오는 흐름에는 검색어가 없습니다. 필터만으로도 조회되어야 합니다. */
    @Test
    void filtersByBrandWithoutKeyword() throws Exception {
        mockMvc.perform(get(SEARCH_URL).param("brand", "Chanel"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.perfumes", Matchers.hasSize(2)))
                .andExpect(jsonPath("$.perfumes[0].perfumeId").value(1))
                .andExpect(jsonPath("$.perfumes[1].perfumeId").value(2))
                .andExpect(jsonPath("$.totalElements").value(2));
    }

    /** 브랜드는 완전 일치입니다. 부분 일치는 keyword 가 담당합니다. */
    @Test
    void matchesBrandExactlyNotPartially() throws Exception {
        mockMvc.perform(get(SEARCH_URL).param("brand", "Chan"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.perfumes", Matchers.hasSize(0)))
                .andExpect(jsonPath("$.totalElements").value(0));
    }

    /** 브랜드 필터가 걸리면 브랜드가 없는 향수는 자연히 빠집니다. */
    @Test
    void excludesPerfumeWithoutBrandWhenBrandFilterGiven() throws Exception {
        mockMvc.perform(get(SEARCH_URL).param("brand", "Chanel"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.perfumes[*].perfumeId", Matchers.not(Matchers.hasItem(5))));
    }

    /** 비활성 향수는 필터로도 나오지 않습니다. 검색과 같은 기준입니다. */
    @Test
    void excludesInactivePerfumeFromFilterResult() throws Exception {
        mockMvc.perform(get(SEARCH_URL).param("brand", "Chanel"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.perfumes[*].perfumeId", Matchers.not(Matchers.hasItem(4))));
    }

    @Test
    void filtersByGenderWithoutKeyword() throws Exception {
        mockMvc.perform(get(SEARCH_URL).param("gender", "MALE"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.perfumes", Matchers.hasSize(1)))
                .andExpect(jsonPath("$.perfumes[0].perfumeId").value(1));
    }

    /**
     * 저장된 값과 대소문자가 다르면 걸리지 않습니다. 수집 파이프라인이 {@code Gender} 어휘를
     * 그대로 넣어야 한다는 계약을 고정합니다. 어긋나면 필터가 조용히 0건이 됩니다.
     */
    @Test
    void doesNotMatchGenderStoredWithDifferentCase() throws Exception {
        mockMvc.perform(get(SEARCH_URL).param("gender", "MALE"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.perfumes[*].perfumeId", Matchers.not(Matchers.hasItem(6))));
    }

    /** 성별이 없는 향수는 성별 필터가 없을 때만 나옵니다. */
    @Test
    void includesPerfumeWithoutGenderWhenGenderFilterAbsent() throws Exception {
        mockMvc.perform(get(SEARCH_URL).param("keyword", "Orphan"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.perfumes", Matchers.hasSize(1)))
                .andExpect(jsonPath("$.perfumes[0].perfumeId").value(5));
    }

    @Test
    void combinesBrandAndGenderWithAnd() throws Exception {
        mockMvc.perform(get(SEARCH_URL).param("brand", "Chanel").param("gender", "FEMALE"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.perfumes", Matchers.hasSize(1)))
                .andExpect(jsonPath("$.perfumes[0].perfumeId").value(2));
    }

    /** 검색어와 필터가 함께 오면 둘 다 만족해야 합니다. 넓히는 것이 아니라 좁힙니다. */
    @Test
    void combinesKeywordAndBrandWithAnd() throws Exception {
        mockMvc.perform(get(SEARCH_URL).param("keyword", "bleu").param("brand", "Diptyque"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.perfumes", Matchers.hasSize(0)));
    }

    @Test
    void combinesKeywordAndBrandThatMatchTogether() throws Exception {
        mockMvc.perform(get(SEARCH_URL).param("keyword", "bleu").param("brand", "Chanel"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.perfumes", Matchers.hasSize(1)))
                .andExpect(jsonPath("$.perfumes[0].perfumeId").value(1));
    }

    /** 조건이 하나도 없으면 조회하지 않습니다. 기능 명세서의 예외·정책을 따릅니다. */
    @Test
    void returnsEmptyWhenNoConditionGiven() throws Exception {
        mockMvc.perform(get(SEARCH_URL))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.perfumes", Matchers.hasSize(0)))
                .andExpect(jsonPath("$.totalElements").value(0));
    }

    /** 빈 문자열 필터는 값이 없는 것과 같게 다룹니다. 공백 이름을 가진 브랜드를 찾으러 가지 않습니다. */
    @Test
    void treatsBlankFilterAsAbsent() throws Exception {
        mockMvc.perform(get(SEARCH_URL).param("brand", "   "))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.perfumes", Matchers.hasSize(0)))
                .andExpect(jsonPath("$.totalElements").value(0));
    }

    /** 모르는 성별 값은 400 입니다. 조용히 0건을 주면 필터가 걸린 것인지 구분할 수 없습니다. */
    @Test
    void rejectsUnknownGenderValue() throws Exception {
        mockMvc.perform(get(SEARCH_URL).param("gender", "ROBOT"))
                .andExpect(status().isBadRequest());
    }

    /** 페이징은 필터가 걸린 결과를 기준으로 셉니다. */
    @Test
    void countsOnlyFilteredPerfumes() throws Exception {
        mockMvc.perform(get(SEARCH_URL).param("brand", "Chanel").param("size", "1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.perfumes", Matchers.hasSize(1)))
                .andExpect(jsonPath("$.size").value(1))
                .andExpect(jsonPath("$.totalElements").value(2));
    }

    private void insertBrand(long id, String name) {
        jdbcTemplate.update(
                "INSERT INTO brands (brand_id, name, is_active) VALUES (?, ?, true)", id, name);
    }

    private void insertPerfume(long id, Integer brandId, String name, String gender, boolean active) {
        jdbcTemplate.update(
                "INSERT INTO perfumes (perfume_id, brand_id, name, gender, is_active)"
                        + " VALUES (?, ?, ?, ?, ?)",
                id, brandId, name, gender, active);
    }

    private void clearData() {
        jdbcTemplate.update("DELETE FROM perfume_images");
        jdbcTemplate.update("DELETE FROM perfumes");
        jdbcTemplate.update("DELETE FROM brands");
    }
}
