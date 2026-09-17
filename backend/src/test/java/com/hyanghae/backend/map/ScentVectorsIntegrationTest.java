package com.hyanghae.backend.map;

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
 * 취향 테스트가 쓰는 계열 벡터 조회를 실제 PostgreSQL 위에서 검증합니다.
 *
 * <p>지도 조회({@link ScentMapIntegrationTest})와 나눠 둔 이유는 <b>거르는 기준이 다르기</b>
 * 때문입니다. 지도는 계열이 없는 향수도 점으로 찍지만, 여기서는 어떤 취향과도 유사도가 0 이라
 * 후보가 될 수 없어 뺍니다.
 *
 * <p>고정 데이터는 빠져야 하는 향수를 종류별로 담고 있습니다.
 *
 * <ul>
 *   <li>향수 1: 계열 두 개. 나가야 합니다.
 *   <li>향수 2: 계열 한 개. 나가야 합니다.
 *   <li>향수 3: 계열이 없습니다. 유사도가 0 이라 빠집니다.
 *   <li>향수 4: 비활성입니다. 빠집니다.
 *   <li>향수 5: 좌표가 없습니다. 지도 밖이라 빠집니다.
 *   <li>향수 6: 국내 선정 순위가 없습니다. 동점을 가를 수 없어 빠집니다.
 *   <li>향수 7: 내려간 계열만 갖습니다. 화면이 고를 수 없는 축이라 빠집니다.
 * </ul>
 *
 * <p>계열은 마이그레이션이 심은 9개를 그대로 씁니다. 프론트가 쓰는 코드와 같은 값이어야 하므로
 * 테스트용으로 새로 만들지 않고 실제 코드로 확인합니다. 내려간 계열만 따로 넣고 끝나면 지웁니다.
 */
@IntegrationTest
@AutoConfigureMockMvc
class ScentVectorsIntegrationTest {

    private static final String VECTORS_URL = "/api/v1/map/scent-vectors";

    /** 마이그레이션이 심어 둔 계열입니다. 프론트의 SCENT_FAMILY_KEYS 와 같은 코드입니다. */
    private static final long FLORAL_ID = 1;
    private static final long GREEN_ID = 2;

    /** 내려간 계열은 겹치지 않도록 큰 번호로 새로 넣습니다. */
    private static final long INACTIVE_REGION_ID = 9101;

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @BeforeEach
    void insertFixtures() {
        clearData();

        jdbcTemplate.update("""
                INSERT INTO scent_regions (scent_region_id, code, name, is_active)
                VALUES (?, 'TEST_RETIRED', '내려간 계열', FALSE)
                """, INACTIVE_REGION_ID);

        jdbcTemplate.update(
                "INSERT INTO brands (brand_id, name, is_active) VALUES (1, 'Chanel', TRUE)");

        insertPerfume(1, "Two Family Scent", 1, true);
        insertPerfume(2, "One Family Scent", 2, true);
        insertPerfume(3, "Bare Scent", 3, true);
        insertPerfume(4, "Retired Scent", 4, false);
        insertPerfume(5, "Off Map Scent", 5, true);
        insertPerfume(6, "No Rank Scent", null, true);
        insertPerfume(7, "Retired Family Scent", 7, true);

        insertMapPoint(1, 0.09163, 0.04484);
        insertMapPoint(2, 0.1863, 0.31502);
        insertMapPoint(3, 0.5, 0.5);
        insertMapPoint(4, 0.6, 0.6);
        insertMapPoint(6, 0.7, 0.7);
        insertMapPoint(7, 0.8, 0.8);
        // 향수 5 는 좌표를 넣지 않습니다.

        insertScentFamily(1, FLORAL_ID, 0.8123);
        insertScentFamily(1, GREEN_ID, 0.2309);
        insertScentFamily(2, GREEN_ID, 1.0);
        insertScentFamily(4, FLORAL_ID, 0.5);
        insertScentFamily(5, FLORAL_ID, 0.5);
        insertScentFamily(6, FLORAL_ID, 0.5);
        insertScentFamily(7, INACTIVE_REGION_ID, 0.9);
        // 향수 3 은 계열을 넣지 않습니다.
    }

    @AfterEach
    void cleanUp() {
        clearData();
    }

    /**
     * 향수 하나에 계열 비중이 <b>모두</b> 실립니다.
     *
     * <p>지도 조회는 대표 계열 하나만 주는데, 코사인 유사도는 아홉 축을 모두 봐야 잴 수 있습니다.
     * 두 응답을 나눈 이유가 여기 있습니다.
     *
     * <p>비중의 합이 1 이 아닙니다. 기준에 못 미치는 계열을 뺀 뒤 정규화하지 않은 값이라
     * 그대로 내보냅니다.
     */
    @Test
    void putsEveryFamilyWeightInOneRow() throws Exception {
        mockMvc.perform(get(VECTORS_URL))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.perfumes[0].perfumeId").value(1))
                .andExpect(jsonPath("$.perfumes[0].x").value(0.09163))
                .andExpect(jsonPath("$.perfumes[0].y").value(0.04484))
                .andExpect(jsonPath("$.perfumes[0].rank").value(1))
                .andExpect(jsonPath("$.perfumes[0].families.FLORAL").value(0.8123))
                .andExpect(jsonPath("$.perfumes[0].families.GREEN").value(0.2309))
                .andExpect(jsonPath("$.perfumes[0].families.length()").value(2))
                .andExpect(jsonPath("$.perfumes[1].perfumeId").value(2))
                .andExpect(jsonPath("$.perfumes[1].families.GREEN").value(1.0))
                .andExpect(jsonPath("$.perfumes[1].families.length()").value(1));
    }

    /**
     * 고를 수 없는 향수는 모두 빠집니다.
     *
     * <p>넷 다 유사도를 잴 수 없거나 결과로 쓸 수 없는 향수입니다. 넣어 두면 화면이 "후보가
     * 몇 개인지" 를 세어 결과 문구를 정하는데 그 수가 부풀려집니다.
     */
    @Test
    void dropsPerfumesThatCannotBeMatched() throws Exception {
        mockMvc.perform(get(VECTORS_URL))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.perfumes.length()").value(2))
                .andExpect(jsonPath("$.perfumes[*].perfumeId")
                        .value(Matchers.contains(1, 2)));
    }

    /**
     * 향수 번호는 {@code fragrantica_id} 가 아니라 우리 {@code perfume_id} 입니다.
     *
     * <p>프론트가 임시로 쓰던 스냅샷은 {@code fragrantica_id} 를 담고 있어, 그 번호로는 향수
     * 상세로 이어갈 수 없었습니다. 이 응답이 붙으면 그 방어 코드가 필요 없어집니다.
     */
    @Test
    void returnsOurPerfumeIdNotTheExternalOne() throws Exception {
        jdbcTemplate.update(
                "UPDATE perfumes SET fragrantica_id = 999001 WHERE perfume_id = 1");

        mockMvc.perform(get(VECTORS_URL))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.perfumes[0].perfumeId").value(1));
    }

    /** 로그인 없이 볼 수 있습니다. 취향 테스트는 가입 직후에 도는데 비회원도 지도를 봅니다. */
    @Test
    void allowsAnonymousAccess() throws Exception {
        mockMvc.perform(get(VECTORS_URL))
                .andExpect(status().isOk());
    }

    /** 벡터가 하나도 없으면 빈 배열입니다. {@code null} 이 아닙니다. */
    @Test
    void returnsAnEmptyArrayWhenThereAreNoVectors() throws Exception {
        jdbcTemplate.update("DELETE FROM perfume_scent_families");

        mockMvc.perform(get(VECTORS_URL))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.perfumes").isArray())
                .andExpect(jsonPath("$.perfumes").isEmpty());
    }

    private void insertPerfume(long id, String name, Integer rank, boolean active) {
        jdbcTemplate.update("""
                INSERT INTO perfumes (perfume_id, brand_id, name, korea_selection_rank, is_active)
                VALUES (?, 1, ?, ?, ?)
                """, id, name, rank, active);
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

    private void clearData() {
        jdbcTemplate.update("DELETE FROM perfume_scent_families");
        jdbcTemplate.update("DELETE FROM perfume_map_points");
        jdbcTemplate.update("DELETE FROM perfumes");
        jdbcTemplate.update("DELETE FROM brands");
        jdbcTemplate.update("DELETE FROM scent_regions WHERE scent_region_id = ?",
                INACTIVE_REGION_ID);
    }
}
