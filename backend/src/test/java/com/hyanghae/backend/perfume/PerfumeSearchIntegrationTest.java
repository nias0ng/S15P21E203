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
        // LIKE 와일드카드가 리터럴로 검색되는지 확인하기 위한 데이터입니다
        insertPerfume(6, null, "100% Pure_Musk", null, true);

        // 1번은 display_order 가 작은 쪽이 대표, 2번은 display_order 가 NULL 인 한 장뿐, 3번은 이미지 없음
        insertImage(10, 1, BLEU_SECONDARY_IMAGE, 2);
        insertImage(11, 1, BLEU_PRIMARY_IMAGE, 1);
        insertImage(12, 2, CHANCE_IMAGE, null);

        // 향 계열이 붙은 향수는 1번뿐입니다. 나머지는 향 계열이 null 이어야 합니다.
        // 1번은 계열 두 개에 걸쳐 있고, 비중이 큰 쪽이 대표입니다.
        // 대표(플로럴)에 일부러 더 큰 계열 번호를 줍니다. 번호순으로 고르면 머스크가 뽑혀
        // 틀린 답이 나오므로, 비중으로 고르는지가 실제로 검증됩니다.
        insertScentRegion(1, "MUSK_POWDERY", "머스크·파우더리");
        insertScentRegion(2, "FLORAL", "플로럴");
        insertScentFamily(1, 1, 0.3181);
        insertScentFamily(1, 2, 0.5976);
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
                .andExpect(jsonPath("$.perfumes[0].perfumeId").value(2))
                .andExpect(jsonPath("$.perfumes[0].name").value("Chance"))
                .andExpect(jsonPath("$.perfumes[0].brandName").value("Chanel"))
                .andExpect(jsonPath("$.perfumes[0].nameKo").doesNotExist());
    }

    @Test
    void findsByBrandName() throws Exception {
        mockMvc.perform(get(SEARCH_URL).param("keyword", "diptyque"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(1))
                .andExpect(jsonPath("$.perfumes[0].name").value("Do Son"));
    }

    @Test
    void findsByKoreanName() throws Exception {
        mockMvc.perform(get(SEARCH_URL).param("keyword", "블루"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(1))
                .andExpect(jsonPath("$.perfumes[0].perfumeId").value(1))
                .andExpect(jsonPath("$.perfumes[0].nameKo").value("블루 드 샤넬"));
    }

    @Test
    void findsByPartialKeyword() throws Exception {
        mockMvc.perform(get(SEARCH_URL).param("keyword", "ptyq"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(1))
                .andExpect(jsonPath("$.perfumes[0].perfumeId").value(3));
    }

    @Test
    void ignoresCaseOfKeyword() throws Exception {
        mockMvc.perform(get(SEARCH_URL).param("keyword", "CHANEL"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(2))
                .andExpect(jsonPath("$.perfumes[0].perfumeId").value(1))
                .andExpect(jsonPath("$.perfumes[1].perfumeId").value(2));
    }

    /**
     * 향 계열은 향 지도 도메인의 테이블에 있어 검색 쿼리와 따로 조회합니다. 붙이지 않으면
     * 화면의 향 계열 뱃지가 비어 있게 됩니다.
     *
     * <p>향수 1 은 플로럴 0.5976, 머스크·파우더리 0.3181 로 두 계열에 걸쳐 있습니다. 비중이 큰
     * 플로럴이 대표입니다. 머스크를 먼저 넣어 두었으므로, 삽입 순서가 아니라 비중으로 고르는지도
     * 함께 확인됩니다.
     */
    @Test
    void usesFamilyWithLargestWeightAsScentFamily() throws Exception {
        mockMvc.perform(get(SEARCH_URL).param("keyword", "bleu"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.perfumes[0].perfumeId").value(1))
                .andExpect(jsonPath("$.perfumes[0].scentFamily").value("FLORAL"));
    }

    /** 향 지도에 자리가 없는 향수도 검색에는 나와야 합니다. 향 계열만 비어 있습니다. */
    @Test
    void returnsNullScentFamilyWhenPerfumeHasNoMapPoint() throws Exception {
        mockMvc.perform(get(SEARCH_URL).param("keyword", "chance"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.perfumes", org.hamcrest.Matchers.hasSize(1)))
                .andExpect(jsonPath("$.perfumes[0].perfumeId").value(2))
                .andExpect(jsonPath("$.perfumes[0].scentFamily").doesNotExist());
    }

    /** 명세에서 빠진 필드를 내보내지 않습니다. 프론트엔드는 perfumes 와 totalElements 만 읽습니다. */
    @Test
    void doesNotIncludeFieldsRemovedFromSpec() throws Exception {
        mockMvc.perform(get(SEARCH_URL).param("keyword", "chanel"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content").doesNotExist())
                .andExpect(jsonPath("$.totalPages").doesNotExist());
    }

    /**
     * 조건이 없으면 활성 향수 전체입니다. 이 엔드포인트를 향수 목록 화면이 함께 쓰는데, 목록
     * 화면은 필터를 걸기 전에도 향수가 보여야 합니다. 비활성 향수 1건은 빠져 5건입니다.
     */
    @Test
    void returnsAllActivePerfumesWhenNoConditionGiven() throws Exception {
        mockMvc.perform(get(SEARCH_URL))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.perfumes", Matchers.hasSize(5)))
                .andExpect(jsonPath("$.totalElements").value(5))
                .andExpect(jsonPath("$.page").value(0))
                .andExpect(jsonPath("$.size").value(20));
    }

    /** 공백뿐인 검색어는 값이 없는 것과 같게 다룹니다. 공백을 포함한 이름을 찾으러 가지 않습니다. */
    @Test
    void treatsBlankKeywordAsNoCondition() throws Exception {
        mockMvc.perform(get(SEARCH_URL).param("keyword", "   "))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.perfumes", Matchers.hasSize(5)))
                .andExpect(jsonPath("$.totalElements").value(5));
    }

    @Test
    void excludesInactivePerfume() throws Exception {
        mockMvc.perform(get(SEARCH_URL).param("keyword", "retired"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(0))
                .andExpect(jsonPath("$.perfumes").isEmpty());
    }

    /** brand_id 가 nullable 이므로 LEFT JOIN 이어야 합니다. INNER JOIN 이면 이 향수가 사라집니다. */
    @Test
    void includesPerfumeWithoutBrand() throws Exception {
        mockMvc.perform(get(SEARCH_URL).param("keyword", "orphan"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(1))
                .andExpect(jsonPath("$.perfumes[0].name").value("Orphan Scent"))
                .andExpect(jsonPath("$.perfumes[0].brandName").doesNotExist());
    }

    /** 대표 이미지는 display_order 가 가장 작은 것입니다. 삽입 순서가 아닙니다. */
    @Test
    void usesLowestDisplayOrderImageAsThumbnail() throws Exception {
        mockMvc.perform(get(SEARCH_URL).param("keyword", "bleu"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.perfumes[0].imageUrl").value(BLEU_PRIMARY_IMAGE));
    }

    /** display_order 가 NULL 이어도 이미지가 한 장뿐이면 그것이 대표입니다. */
    @Test
    void usesOnlyImageAsThumbnailEvenWhenDisplayOrderIsNull() throws Exception {
        mockMvc.perform(get(SEARCH_URL).param("keyword", "chance"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.perfumes[0].imageUrl").value(CHANCE_IMAGE));
    }

    @Test
    void returnsNoThumbnailWhenPerfumeHasNoImage() throws Exception {
        mockMvc.perform(get(SEARCH_URL).param("keyword", "do son"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(1))
                .andExpect(jsonPath("$.perfumes[0].imageUrl").doesNotExist());
    }

    /** ORDER BY 가 없으면 페이지 간에 항목이 중복되거나 누락될 수 있습니다. */
    @Test
    void paginatesInStableOrder() throws Exception {
        mockMvc.perform(get(SEARCH_URL).param("keyword", "chanel").param("size", "1").param("page", "0"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(2))
                .andExpect(jsonPath("$.perfumes.length()").value(1))
                .andExpect(jsonPath("$.perfumes[0].perfumeId").value(1));

        mockMvc.perform(get(SEARCH_URL).param("keyword", "chanel").param("size", "1").param("page", "1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.perfumes.length()").value(1))
                .andExpect(jsonPath("$.perfumes[0].perfumeId").value(2));
    }

    /** 검색어의 % 를 이스케이프하지 않으면 모든 이름과 일치해 활성 향수 전체가 조회됩니다. */
    @Test
    void treatsPercentInKeywordAsLiteral() throws Exception {
        mockMvc.perform(get(SEARCH_URL).param("keyword", "%"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(1))
                .andExpect(jsonPath("$.perfumes[0].perfumeId").value(6));
    }

    /** 밑줄은 LIKE 에서 임의의 한 글자를 뜻하므로 이스케이프하지 않으면 거의 모든 이름과 일치합니다. */
    @Test
    void treatsUnderscoreInKeywordAsLiteral() throws Exception {
        mockMvc.perform(get(SEARCH_URL).param("keyword", "_"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(1))
                .andExpect(jsonPath("$.perfumes[0].perfumeId").value(6));
    }

    /** 이스케이프 문자 자신도 이스케이프되어야 합니다. */
    @Test
    void treatsEscapeCharacterInKeywordAsLiteral() throws Exception {
        mockMvc.perform(get(SEARCH_URL).param("keyword", "!"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(0));
    }

    /** 범위를 벗어난 페이지는 빈 목록을 반환하고 전체 건수는 유지되어야 합니다. */
    @Test
    void returnsEmptyContentForPageBeyondLastPage() throws Exception {
        mockMvc.perform(get(SEARCH_URL).param("keyword", "chanel").param("size", "1").param("page", "9999"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.perfumes").isEmpty())
                .andExpect(jsonPath("$.totalElements").value(2))
                .andExpect(jsonPath("$.page").value(9999));
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

    private void insertScentRegion(long id, String code, String name) {
        jdbcTemplate.update(
                "INSERT INTO scent_regions (scent_region_id, code, name, is_active)"
                        + " VALUES (?, ?, ?, true)",
                id, code, name);
    }

    private void insertScentFamily(long perfumeId, long scentRegionId, double weight) {
        jdbcTemplate.update(
                "INSERT INTO perfume_scent_families (perfume_id, scent_region_id, weight)"
                        + " VALUES (?, ?, ?)",
                perfumeId, scentRegionId, weight);
    }

    private void clearPerfumeData() {
        jdbcTemplate.update("DELETE FROM perfume_scent_families");
        jdbcTemplate.update("DELETE FROM perfume_images");
        jdbcTemplate.update("DELETE FROM perfumes");
        jdbcTemplate.update("DELETE FROM brands");
        jdbcTemplate.update("DELETE FROM scent_regions");
    }
}
