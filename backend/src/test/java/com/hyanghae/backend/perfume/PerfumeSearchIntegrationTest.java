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

    private static final String BLEU_PRIMARY_IMAGE = "https://img.example.com/bleu-1.jpg";
    private static final String BLEU_SECONDARY_IMAGE = "https://img.example.com/bleu-2.jpg";
    private static final String CHANCE_IMAGE = "https://img.example.com/chance.jpg";

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @BeforeEach
    void insertFixtures() {
        clearPerfumeData();

        insertBrand(1, "Chanel");
        insertBrand(2, "Diptyque");

        insertPerfume(1, 1, "Bleu de Chanel", "블루 드 샤넬", true);
        insertPerfume(2, 1, "Chance", null, true);
        insertPerfume(3, 2, "Do Son", "두 손", true);
        insertPerfume(4, 2, "Retired Scent", null, false);
        insertPerfume(5, null, "Orphan Scent", null, true);

        // 1번은 display_order 가 작은 쪽이 대표, 2번은 display_order 가 NULL 인 한 장뿐, 3번은 이미지 없음
        insertImage(10, 1, BLEU_SECONDARY_IMAGE, 2);
        insertImage(11, 1, BLEU_PRIMARY_IMAGE, 1);
        insertImage(12, 2, CHANCE_IMAGE, null);
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
    void findsByPartialKeyword() throws Exception {
        mockMvc.perform(get(SEARCH_URL).param("keyword", "ptyq"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(1))
                .andExpect(jsonPath("$.content[0].perfumeId").value(3));
    }

    @Test
    void ignoresCaseOfKeyword() throws Exception {
        mockMvc.perform(get(SEARCH_URL).param("keyword", "CHANEL"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(2))
                .andExpect(jsonPath("$.content[0].perfumeId").value(1))
                .andExpect(jsonPath("$.content[1].perfumeId").value(2));
    }

    /** 기능 명세: 검색어가 입력되지 않은 경우 검색을 수행하지 않는다. */
    @Test
    void returnsEmptyResultWhenKeywordIsMissing() throws Exception {
        mockMvc.perform(get(SEARCH_URL))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content").isEmpty())
                .andExpect(jsonPath("$.totalElements").value(0))
                .andExpect(jsonPath("$.totalPages").value(0))
                .andExpect(jsonPath("$.page").value(0))
                .andExpect(jsonPath("$.size").value(20));
    }

    @Test
    void returnsEmptyResultWhenKeywordIsBlank() throws Exception {
        mockMvc.perform(get(SEARCH_URL).param("keyword", "   "))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content").isEmpty())
                .andExpect(jsonPath("$.totalElements").value(0));
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

    /** 대표 이미지는 display_order 가 가장 작은 것입니다. 삽입 순서가 아닙니다. */
    @Test
    void usesLowestDisplayOrderImageAsThumbnail() throws Exception {
        mockMvc.perform(get(SEARCH_URL).param("keyword", "bleu"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content[0].thumbnailUrl").value(BLEU_PRIMARY_IMAGE));
    }

    /** display_order 가 NULL 이어도 이미지가 한 장뿐이면 그것이 대표입니다. */
    @Test
    void usesOnlyImageAsThumbnailEvenWhenDisplayOrderIsNull() throws Exception {
        mockMvc.perform(get(SEARCH_URL).param("keyword", "chance"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content[0].thumbnailUrl").value(CHANCE_IMAGE));
    }

    @Test
    void returnsNoThumbnailWhenPerfumeHasNoImage() throws Exception {
        mockMvc.perform(get(SEARCH_URL).param("keyword", "do son"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(1))
                .andExpect(jsonPath("$.content[0].thumbnailUrl").doesNotExist());
    }

    /** ORDER BY 가 없으면 페이지 간에 항목이 중복되거나 누락될 수 있습니다. */
    @Test
    void paginatesInStableOrder() throws Exception {
        mockMvc.perform(get(SEARCH_URL).param("keyword", "chanel").param("size", "1").param("page", "0"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(2))
                .andExpect(jsonPath("$.totalPages").value(2))
                .andExpect(jsonPath("$.content.length()").value(1))
                .andExpect(jsonPath("$.content[0].perfumeId").value(1));

        mockMvc.perform(get(SEARCH_URL).param("keyword", "chanel").param("size", "1").param("page", "1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content.length()").value(1))
                .andExpect(jsonPath("$.content[0].perfumeId").value(2));
    }

    private void insertBrand(long id, String name) {
        jdbcTemplate.update(
                "INSERT INTO brands (brand_id, name, is_active) VALUES (?, ?, true)",
                id, name
        );
    }

    private void insertPerfume(long id, Integer brandId, String name, String nameKo, boolean active) {
        jdbcTemplate.update(
                "INSERT INTO perfumes (perfume_id, brand_id, name, name_ko, is_active) VALUES (?, ?, ?, ?, ?)",
                id, brandId, name, nameKo, active
        );
    }

    private void insertImage(long id, long perfumeId, String imageUrl, Integer displayOrder) {
        jdbcTemplate.update(
                "INSERT INTO perfume_images (image_id, perfume_id, image_url, display_order) VALUES (?, ?, ?, ?)",
                id, perfumeId, imageUrl, displayOrder
        );
    }

    private void clearPerfumeData() {
        jdbcTemplate.update("DELETE FROM perfume_images");
        jdbcTemplate.update("DELETE FROM perfumes");
        jdbcTemplate.update("DELETE FROM brands");
    }
}
