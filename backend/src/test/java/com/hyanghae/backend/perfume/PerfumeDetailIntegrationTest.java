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
 * 향수 기본 정보 조회 API 를 실제 PostgreSQL 위에서 검증합니다.
 *
 * <p>기능 명세가 향조·후기·후기 통계·계절별 평가를 별도 기능으로 분리했으므로, 그 필드들이 응답에
 * 없다는 것도 함께 단언합니다.
 */
@IntegrationTest
@AutoConfigureMockMvc
class PerfumeDetailIntegrationTest {

    private static final String DETAIL_URL = "/api/v1/perfumes/{perfumeId}";

    private static final String PRIMARY_IMAGE = "https://img.example.com/bleu-1.jpg";
    private static final String SECONDARY_IMAGE = "https://img.example.com/bleu-2.jpg";
    private static final String DESCRIPTION = "시트러스와 우디가 교차하는 브랜드 공식 설명입니다.";

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @BeforeEach
    void insertFixtures() {
        clearPerfumeData();

        insertBrand(1, "Chanel");

        insertPerfume(1, 1, "Bleu de Chanel", DESCRIPTION, true);
        insertPerfume(2, 1, "No Image Scent", null, true);
        insertPerfume(3, null, "Orphan Scent", null, true);
        insertPerfume(4, 1, "Retired Scent", null, false);

        // display_order 가 작은 쪽이 대표입니다. 삽입 순서가 아닙니다.
        insertImage(10, 1, SECONDARY_IMAGE, 2);
        insertImage(11, 1, PRIMARY_IMAGE, 1);
    }

    @AfterEach
    void cleanUp() {
        clearPerfumeData();
    }

    @Test
    void returnsBasicInformation() throws Exception {
        mockMvc.perform(get(DETAIL_URL, 1))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.perfumeId").value(1))
                .andExpect(jsonPath("$.name").value("Bleu de Chanel"))
                .andExpect(jsonPath("$.brand").value("Chanel"))
                .andExpect(jsonPath("$.description").value(DESCRIPTION))
                .andExpect(jsonPath("$.thumbnailUrl").value(PRIMARY_IMAGE));
    }

    /** 명세: 향조·후기·후기 통계·계절별 평가는 각각의 별도 기능에서 제공한다. */
    @Test
    void doesNotIncludeFieldsProvidedByOtherEndpoints() throws Exception {
        mockMvc.perform(get(DETAIL_URL, 1))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.notes").doesNotExist())
                .andExpect(jsonPath("$.reviewCount").doesNotExist())
                .andExpect(jsonPath("$.averageScore").doesNotExist())
                .andExpect(jsonPath("$.seasonRatings").doesNotExist());
    }

    @Test
    void returnsNoThumbnailWhenPerfumeHasNoImage() throws Exception {
        mockMvc.perform(get(DETAIL_URL, 2))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.perfumeId").value(2))
                .andExpect(jsonPath("$.thumbnailUrl").doesNotExist());
    }

    /** brand_id 가 nullable 이므로 LEFT JOIN 이어야 합니다. INNER JOIN 이면 404 가 됩니다. */
    @Test
    void returnsPerfumeWithoutBrand() throws Exception {
        mockMvc.perform(get(DETAIL_URL, 3))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.perfumeId").value(3))
                .andExpect(jsonPath("$.brand").doesNotExist());
    }

    /** 명세: 향수 정보가 존재하지 않는 경우 조회 실패 사실을 안내한다. */
    @Test
    void returnsNotFoundWhenPerfumeDoesNotExist() throws Exception {
        mockMvc.perform(get(DETAIL_URL, 999))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value(PerfumeErrorCode.PERFUME_NOT_FOUND.code()))
                .andExpect(jsonPath("$.message").value(PerfumeErrorCode.PERFUME_NOT_FOUND.message()));
    }

    /** 비활성 향수는 검색에서 제외하는 것과 같은 기준으로 조회되지 않습니다. */
    @Test
    void returnsNotFoundForInactivePerfume() throws Exception {
        mockMvc.perform(get(DETAIL_URL, 4))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value(PerfumeErrorCode.PERFUME_NOT_FOUND.code()));
    }

    @Test
    void returnsBadRequestWhenPerfumeIdIsNotNumeric() throws Exception {
        mockMvc.perform(get("/api/v1/perfumes/abc"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("BAD_REQUEST"));
    }

    private void insertBrand(long id, String name) {
        jdbcTemplate.update(
                "INSERT INTO brands (brand_id, name, is_active) VALUES (?, ?, true)",
                id, name
        );
    }

    private void insertPerfume(long id, Integer brandId, String name, String description, boolean active) {
        jdbcTemplate.update(
                "INSERT INTO perfumes (perfume_id, brand_id, name, description, is_active) VALUES (?, ?, ?, ?, ?)",
                id, brandId, name, description, active
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
