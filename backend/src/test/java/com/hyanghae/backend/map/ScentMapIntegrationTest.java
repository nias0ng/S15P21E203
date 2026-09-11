package com.hyanghae.backend.map;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.hyanghae.backend.map.exception.MapErrorCode;
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
 * 향 지도 조회를 실제 PostgreSQL 위에서 검증합니다.
 *
 * <p>고정 데이터는 지도에 찍히는 향수와 찍히지 않는 향수를 나눠 담고 있습니다.
 *
 * <ul>
 *   <li>향수 1: 좌표 (0.2, 0.3). 계열 두 개를 갖고 비중이 큰 쪽이 대표입니다. 이미지가 두 장입니다.
 *   <li>향수 2: 좌표 (0.5, 0.5). 조회 범위의 경계에 정확히 걸립니다.
 *   <li>향수 3: 좌표 (0.9, 0.9). 조회 범위 밖입니다.
 *   <li>향수 4: 좌표는 있지만 비활성입니다.
 *   <li>향수 5: 활성이지만 좌표가 없습니다. 지도에 찍을 자리가 없습니다.
 *   <li>향수 6: 좌표 (0.1, 0.1). 계열도 이미지도 없습니다.
 * </ul>
 *
 * <p>향 계열은 마이그레이션이 심은 9개가 이미 있습니다. 그 행을 고치면 다른 테스트에 남으므로
 * 계열 두 개를 새로 넣어 활성·비활성과 폴리곤을 확인하고, 끝나면 지웁니다.
 */
@IntegrationTest
@AutoConfigureMockMvc
class ScentMapIntegrationTest {

    private static final String MAP_URL = "/api/v1/map";
    private static final String MAP_PERFUME_URL = "/api/v1/map/perfumes/{perfumeId}";

    private static final long ACTIVE_TEST_REGION_ID = 9001;
    private static final long INACTIVE_TEST_REGION_ID = 9002;

    /** 조각 두 개짜리 폴리곤입니다. 계열 영역이 사각형 하나가 아니라는 것을 담고 있습니다. */
    private static final String POLYGON =
            "[[[0.1,0.2],[0.3,0.2],[0.3,0.4]],[[0.6,0.6],[0.7,0.6],[0.7,0.7]]]";

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @BeforeEach
    void insertFixtures() {
        clearData();

        insertRegion(ACTIVE_TEST_REGION_ID, "TEST_ACTIVE", "테스트 계열", 100, true);
        insertRegion(INACTIVE_TEST_REGION_ID, "TEST_INACTIVE", "사라진 계열", 101, false);

        insertBrand(1, "Chanel");
        insertPerfume(1, "Base Scent", "베이스 향수", true);
        insertPerfume(2, "Edge Scent", "경계 향수", true);
        insertPerfume(3, "Far Scent", "먼 향수", true);
        insertPerfume(4, "Retired Scent", "비활성 향수", false);
        insertPerfume(5, "Off Map Scent", "지도 밖 향수", true);
        insertPerfume(6, "Bare Scent", "맨 향수", true);

        insertMapPoint(1, 0.2, 0.3);
        insertMapPoint(2, 0.5, 0.5);
        insertMapPoint(3, 0.9, 0.9);
        insertMapPoint(4, 0.2, 0.2);
        insertMapPoint(6, 0.1, 0.1);

        // 향수 1 의 대표는 비중이 큰 FLORAL 입니다. CITRUS 가 계열 번호로는 앞입니다.
        insertScentFamily(1, regionIdOf("CITRUS"), 0.3);
        insertScentFamily(1, regionIdOf("FLORAL"), 0.6);

        insertImage(10, 1, "second.jpg", 2);
        insertImage(11, 1, "first.jpg", 1);
    }

    @AfterEach
    void cleanUp() {
        clearData();
    }

    /** 활성 계열만 나가고, 저장된 폴리곤이 그대로 실려 나갑니다. */
    @Test
    void servesActiveRegionsWithStoredPolygon() throws Exception {
        mockMvc.perform(get(MAP_URL))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.regions[?(@.code == 'TEST_INACTIVE')]").isEmpty())
                // 테스트 계열은 display_order 가 가장 커서 마지막(10번째)입니다.
                // 그 순서는 ordersRegionsByDisplayOrder 가 고정합니다.
                .andExpect(jsonPath("$.regions[9].code").value("TEST_ACTIVE"))
                .andExpect(jsonPath("$.regions[9].name").value("테스트 계열"))
                .andExpect(jsonPath("$.regions[9].anchorX").value(0.5))
                .andExpect(jsonPath("$.regions[9].anchorY").value(0.6))
                .andExpect(jsonPath("$.regions[9].polygon.length()").value(2))
                .andExpect(jsonPath("$.regions[9].polygon[0][0][0]").value(0.1))
                .andExpect(jsonPath("$.regions[9].polygon[1][2][1]").value(0.7));
    }

    /**
     * 계열은 범례 순서로 나갑니다.
     *
     * <p>마이그레이션이 심은 9개가 먼저이고 {@code display_order} 를 크게 준 테스트 계열이
     * 마지막입니다. 순서가 흔들리면 지도 범례가 요청마다 달라집니다.
     */
    @Test
    void ordersRegionsByDisplayOrder() throws Exception {
        mockMvc.perform(get(MAP_URL))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.regions[0].code").value("CITRUS"))
                .andExpect(jsonPath("$.regions[9].code").value("TEST_ACTIVE"));
    }

    /**
     * 지도에 찍히는 향수만 나갑니다.
     *
     * <p>좌표가 없는 향수(5)와 비활성 향수(4)는 빠집니다. 좌표가 없는 향수는 찍을 자리가 없고,
     * 비활성 향수는 눌러도 상세가 404 입니다.
     */
    @Test
    void servesOnlyPerfumesThatHaveCoordinates() throws Exception {
        mockMvc.perform(get(MAP_URL))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.perfumes.length()").value(4))
                .andExpect(jsonPath("$.perfumes[*].perfumeId")
                        .value(Matchers.contains(1, 2, 3, 6)))
                .andExpect(jsonPath("$.perfumes[0].name").value("Base Scent"))
                .andExpect(jsonPath("$.perfumes[0].x").value(0.2))
                .andExpect(jsonPath("$.perfumes[0].y").value(0.3));
    }

    /**
     * 목록에도 대표 이미지가 함께 나갑니다.
     *
     * <p>화면은 배와 가까운 향수 몇 개만 그리고 그 몇 개가 배를 움직일 때마다 바뀝니다. 주소를
     * 선택 시점에 따로 불러오면 이동할 때마다 요청이 여러 개 나갑니다.
     */
    @Test
    void servesRepresentativeImageInTheList() throws Exception {
        mockMvc.perform(get(MAP_URL))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.perfumes[0].imageUrl").value("first.jpg"))
                .andExpect(jsonPath("$.perfumes[3].perfumeId").value(6))
                .andExpect(jsonPath("$.perfumes[3].imageUrl").doesNotExist());
    }

    /** 대표 계열은 비중이 가장 큰 계열입니다. 계열이 없는 향수는 {@code null} 입니다. */
    @Test
    void usesDominantScentFamilyAsRegion() throws Exception {
        mockMvc.perform(get(MAP_URL))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.perfumes[0].scentRegionId").value(regionIdOf("FLORAL")))
                .andExpect(jsonPath("$.perfumes[3].perfumeId").value(6))
                .andExpect(jsonPath("$.perfumes[3].scentRegionId").doesNotExist());
    }

    /** 범위를 주면 향수를 자릅니다. 경계에 걸친 향수는 포함합니다. */
    @Test
    void filtersPerfumesByViewportIncludingBoundary() throws Exception {
        mockMvc.perform(get(MAP_URL)
                        .param("minX", "0")
                        .param("maxX", "0.5")
                        .param("minY", "0")
                        .param("maxY", "0.5"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.perfumes[*].perfumeId")
                        .value(Matchers.contains(1, 2, 6)));
    }

    /**
     * 범위 안에 향수가 없어도 계열은 그대로 나갑니다.
     *
     * <p>계열 영역은 범위로 자르지 않습니다. 폴리곤이 지도 바깥 여백까지 뻗어 있어 좌표계가 다르고,
     * 잘라 주면 화면이 영역을 그릴 수 없습니다.
     */
    @Test
    void keepsRegionsWhenViewportHasNoPerfume() throws Exception {
        mockMvc.perform(get(MAP_URL)
                        .param("minX", "0.95")
                        .param("maxX", "1")
                        .param("minY", "0.95")
                        .param("maxY", "1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.perfumes").isEmpty())
                .andExpect(jsonPath("$.regions[?(@.code == 'TEST_ACTIVE')]").isNotEmpty());
    }

    /**
     * 범위를 일부만 주면 400 입니다.
     *
     * <p>나머지를 빠뜨린 실수일 가능성이 훨씬 큽니다. 조용히 한쪽만 걸어 주면 화면은 범위 조회가
     * 된 줄로 압니다.
     */
    @Test
    void rejectsPartialViewport() throws Exception {
        mockMvc.perform(get(MAP_URL).param("minX", "0.1"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code")
                        .value(MapErrorCode.MAP_VIEWPORT_INCOMPLETE.code()));
    }

    /** 최솟값이 최댓값보다 크면 400 입니다. 빈 목록으로 답하면 "향수가 없다"와 구분되지 않습니다. */
    @Test
    void rejectsInvertedViewport() throws Exception {
        mockMvc.perform(get(MAP_URL)
                        .param("minX", "0.8")
                        .param("maxX", "0.2")
                        .param("minY", "0")
                        .param("maxY", "1"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code")
                        .value(MapErrorCode.MAP_VIEWPORT_INVERTED.code()));
    }

    /** 선택한 향수의 요약입니다. 이미지는 대표 한 장이고 {@code display_order} 가 작은 쪽입니다. */
    @Test
    void servesSelectedPerfume() throws Exception {
        mockMvc.perform(get(MAP_PERFUME_URL, 1))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.perfumeId").value(1))
                .andExpect(jsonPath("$.name").value("Base Scent"))
                .andExpect(jsonPath("$.nameKo").value("베이스 향수"))
                .andExpect(jsonPath("$.imageUrl").value("first.jpg"))
                .andExpect(jsonPath("$.x").value(0.2))
                .andExpect(jsonPath("$.y").value(0.3))
                .andExpect(jsonPath("$.scentRegionId").value(regionIdOf("FLORAL")));
    }

    /** 이미지도 계열도 없는 향수는 두 값이 비어서 나갑니다. 지도에 찍히는 것은 좌표뿐입니다. */
    @Test
    void servesPerfumeWithoutImageOrFamily() throws Exception {
        mockMvc.perform(get(MAP_PERFUME_URL, 6))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.imageUrl").doesNotExist())
                .andExpect(jsonPath("$.scentRegionId").doesNotExist());
    }

    /**
     * 지도에 없는 향수는 404 입니다.
     *
     * <p>좌표가 없는 향수, 비활성 향수, 아예 없는 향수를 같은 코드로 답합니다. 화면이 할 일이
     * 같고, 구분해 주면 어떤 향수가 존재하는지가 응답으로 새어 나갑니다.
     */
    @Test
    void returnsNotFoundForPerfumesOffTheMap() throws Exception {
        for (long perfumeId : new long[]{5, 4, 999}) {
            mockMvc.perform(get(MAP_PERFUME_URL, perfumeId))
                    .andExpect(status().isNotFound())
                    .andExpect(jsonPath("$.code")
                            .value(MapErrorCode.MAP_PERFUME_NOT_FOUND.code()));
        }
    }

    private long regionIdOf(String code) {
        return jdbcTemplate.queryForObject(
                "SELECT scent_region_id FROM scent_regions WHERE code = ?", Long.class, code);
    }

    private void insertRegion(
            long id, String code, String name, int displayOrder, boolean active) {
        jdbcTemplate.update(
                "INSERT INTO scent_regions"
                        + " (scent_region_id, code, name, display_order, anchor_x, anchor_y,"
                        + " polygon, is_active)"
                        + " VALUES (?, ?, ?, ?, 0.5, 0.6, ?::jsonb, ?)",
                id, code, name, displayOrder, POLYGON, active);
    }

    private void insertBrand(long id, String name) {
        jdbcTemplate.update(
                "INSERT INTO brands (brand_id, name, is_active) VALUES (?, ?, true)", id, name);
    }

    private void insertPerfume(long id, String name, String nameKo, boolean active) {
        jdbcTemplate.update(
                "INSERT INTO perfumes (perfume_id, brand_id, name, name_ko, is_active)"
                        + " VALUES (?, 1, ?, ?, ?)",
                id, name, nameKo, active);
    }

    private void insertMapPoint(long perfumeId, double x, double y) {
        jdbcTemplate.update(
                "INSERT INTO perfume_map_points (perfume_id, map_x, map_y) VALUES (?, ?, ?)",
                perfumeId, x, y);
    }

    private void insertScentFamily(long perfumeId, long scentRegionId, double weight) {
        jdbcTemplate.update(
                "INSERT INTO perfume_scent_families (perfume_id, scent_region_id, weight)"
                        + " VALUES (?, ?, ?)",
                perfumeId, scentRegionId, weight);
    }

    private void insertImage(long id, long perfumeId, String url, int displayOrder) {
        jdbcTemplate.update(
                "INSERT INTO perfume_images (image_id, perfume_id, image_url, display_order)"
                        + " VALUES (?, ?, ?, ?)",
                id, perfumeId, url, displayOrder);
    }

    /**
     * 테스트가 넣은 것만 지웁니다.
     *
     * <p>{@code scent_regions} 는 마이그레이션이 심은 계열 9개가 들어 있어 전체를 지우면 다른
     * 테스트가 함께 깨집니다. 그래서 테스트가 넣은 두 행만 번호로 지웁니다.
     */
    private void clearData() {
        jdbcTemplate.update("DELETE FROM perfume_scent_families");
        jdbcTemplate.update("DELETE FROM perfume_map_points");
        jdbcTemplate.update("DELETE FROM perfume_images");
        jdbcTemplate.update("DELETE FROM perfumes");
        jdbcTemplate.update("DELETE FROM brands");
        jdbcTemplate.update(
                "DELETE FROM scent_regions WHERE scent_region_id IN (?, ?)",
                ACTIVE_TEST_REGION_ID, INACTIVE_TEST_REGION_ID);
    }
}
