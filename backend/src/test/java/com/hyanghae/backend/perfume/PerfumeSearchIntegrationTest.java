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
 * 향수 검색 API 를 실제 PostgreSQL 위에서 검증합니다.
 *
 * <p>고정 데이터는 SQL 로 직접 넣습니다. 향수 데이터는 별도 적재 파이프라인이 채우는 것이고
 * 이 API 는 읽기 전용이므로, 엔티티에 테스트만을 위한 생성자를 추가하지 않았습니다.
 * 덤으로 컬럼 이름이 스키마와 맞는지도 함께 확인됩니다.
 */
@IntegrationTest
@AutoConfigureMockMvc
class PerfumeSearchIntegrationTest {

    private static final String SEARCH_URL = "/api/v1/perfumes";

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @BeforeEach
    void insertFixtures() {
        clearPerfumeData();

        jdbcTemplate.update("INSERT INTO brands (brand_id, name, is_active) VALUES (1, 'Chanel', true)");
        jdbcTemplate.update("INSERT INTO brands (brand_id, name, is_active) VALUES (2, 'Diptyque', true)");

        insertPerfume(1, 1, "Bleu de Chanel", "블루 드 샤넬", true);
        insertPerfume(2, 1, "Chance", null, true);
        insertPerfume(3, 2, "Do Son", "두 손", true);
        insertPerfume(4, 2, "Retired Scent", null, false);
        insertPerfume(5, null, "Orphan Scent", null, true);
    }

    @AfterEach
    void cleanUp() {
        clearPerfumeData();
    }

    @Test
    void findsByPerfumeName() throws Exception {
        mockMvc.perform(get(SEARCH_URL).param("keyword", "chance"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(1))
                .andExpect(jsonPath("$.content[0].perfumeId").value(2))
                .andExpect(jsonPath("$.content[0].name").value("Chance"))
                .andExpect(jsonPath("$.content[0].brand").value("Chanel"));
    }

    @Test
    void findsByBrandName() throws Exception {
        mockMvc.perform(get(SEARCH_URL).param("keyword", "diptyque"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(1))
                .andExpect(jsonPath("$.content[0].name").value("Do Son"));
    }

    @Test
    void findsByKoreanName() throws Exception {
        mockMvc.perform(get(SEARCH_URL).param("keyword", "블루"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(1))
                .andExpect(jsonPath("$.content[0].perfumeId").value(1));
    }

    @Test
    void ignoresCaseOfKeyword() throws Exception {
        mockMvc.perform(get(SEARCH_URL).param("keyword", "CHANEL"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(2))
                .andExpect(jsonPath("$.content[0].perfumeId").value(1))
                .andExpect(jsonPath("$.content[1].perfumeId").value(2));
    }

    @Test
    void returnsAllActivePerfumesWhenKeywordIsBlank() throws Exception {
        mockMvc.perform(get(SEARCH_URL).param("keyword", "   "))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(4));
    }

    @Test
    void returnsAllActivePerfumesWhenKeywordIsMissing() throws Exception {
        mockMvc.perform(get(SEARCH_URL))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(4))
                .andExpect(jsonPath("$.page").value(0))
                .andExpect(jsonPath("$.size").value(20))
                .andExpect(jsonPath("$.totalPages").value(1));
    }

    @Test
    void excludesInactivePerfume() throws Exception {
        mockMvc.perform(get(SEARCH_URL).param("keyword", "retired"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(0))
                .andExpect(jsonPath("$.content").isEmpty());
    }

    /** brand_id 가 nullable 이므로 LEFT JOIN 이어야 합니다. INNER JOIN 이면 이 향수가 사라집니다. */
    @Test
    void includesPerfumeWithoutBrand() throws Exception {
        mockMvc.perform(get(SEARCH_URL).param("keyword", "orphan"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(1))
                .andExpect(jsonPath("$.content[0].name").value("Orphan Scent"))
                .andExpect(jsonPath("$.content[0].brand").doesNotExist());
    }

    /** ORDER BY 가 없으면 페이지 간에 항목이 중복되거나 누락될 수 있습니다. */
    @Test
    void paginatesInStableOrder() throws Exception {
        mockMvc.perform(get(SEARCH_URL).param("size", "2").param("page", "0"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(4))
                .andExpect(jsonPath("$.totalPages").value(2))
                .andExpect(jsonPath("$.content.length()").value(2))
                .andExpect(jsonPath("$.content[0].perfumeId").value(1))
                .andExpect(jsonPath("$.content[1].perfumeId").value(2));

        mockMvc.perform(get(SEARCH_URL).param("size", "2").param("page", "1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content.length()").value(2))
                .andExpect(jsonPath("$.content[0].perfumeId").value(3))
                .andExpect(jsonPath("$.content[1].perfumeId").value(5));
    }

    private void insertPerfume(long id, Integer brandId, String name, String nameKo, boolean active) {
        jdbcTemplate.update(
                "INSERT INTO perfumes (perfume_id, brand_id, name, name_ko, is_active) VALUES (?, ?, ?, ?, ?)",
                id, brandId, name, nameKo, active
        );
    }

    private void clearPerfumeData() {
        jdbcTemplate.update("DELETE FROM perfumes");
        jdbcTemplate.update("DELETE FROM brands");
    }
}
