package com.hyanghae.backend.perfume;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.hyanghae.backend.support.IntegrationTest;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.jdbc.core.JdbcTemplate;

/**
 * 향 지도 스키마가 인계받은 데이터를 받아내는지 확인합니다.
 *
 * <p>여기서 확인하는 것은 값의 범위를 잘못 좁혀 두지 않았는지입니다. 제약을 실제 데이터보다 좁게
 * 걸면 적재가 통째로 실패하고, 넓게 걸면 잘못된 값이 조용히 들어옵니다. 어느 쪽이든 적재를
 * 돌려 보기 전에는 드러나지 않으므로, 각 제약의 경계를 여기서 못 박아 둡니다.
 *
 * <p>단언마다 근거가 되는 측정값이 있습니다. 측정값은 {@code backend/db/seed} 의 CSV 에서 직접
 * 센 것이고, 적재 스크립트 {@code load_scent_map.sql} 이 같은 값을 다시 확인합니다.
 *
 * <p>고정 데이터는 SQL 로 직접 넣습니다. 향 지도 데이터는 적재 스크립트가 채우는 것이라 엔티티에
 * 테스트만을 위한 생성자를 두지 않았습니다.
 */
@IntegrationTest
class ScentMapSchemaIntegrationTest {

    /** 마이그레이션이 심어 둔 계열 9개와 겹치지 않도록 큰 번호를 씁니다. */
    private static final long REGION_ID = 9001L;
    private static final long OTHER_REGION_ID = 9002L;
    private static final long BRAND_ID = 9001L;
    private static final long PERFUME_ID = 9001L;
    private static final long OTHER_PERFUME_ID = 9002L;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @BeforeEach
    void insertFixtures() {
        clearFixtures();

        jdbcTemplate.update("INSERT INTO brands (brand_id, name) VALUES (?, ?)", BRAND_ID, "테스트 브랜드");
        insertPerfume(PERFUME_ID, "Schema Probe", 900001L);
        insertPerfume(OTHER_PERFUME_ID, "Schema Probe Neighbor", 900002L);
        insertScentRegion(REGION_ID, "TEST_REGION_A");
        insertScentRegion(OTHER_REGION_ID, "TEST_REGION_B");
    }

    @AfterEach
    void cleanUp() {
        clearFixtures();
    }

    /**
     * 계열을 뽑는 기준은 0.24 지만 비중이 가장 큰 계열은 기준에 못 미쳐도 반드시 넣기 때문에,
     * 실제 데이터의 최솟값이 0.2 입니다. 0.24 로 제약을 걸면 적재가 실패합니다.
     */
    @Test
    void acceptsScentFamilyWeightBelowTheExtractionThreshold() {
        assertThatCode(() -> insertScentFamily(PERFUME_ID, REGION_ID, "0.200000"))
                .doesNotThrowAnyException();
    }

    @Test
    void rejectsScentFamilyWeightOutsideZeroToOne() {
        assertThatThrownBy(() -> insertScentFamily(PERFUME_ID, REGION_ID, "0"))
                .isInstanceOf(DataIntegrityViolationException.class);
        assertThatThrownBy(() -> insertScentFamily(PERFUME_ID, REGION_ID, "1.500000"))
                .isInstanceOf(DataIntegrityViolationException.class);
    }

    /**
     * 기준 미달인 계열이 빠진 뒤 정규화하지 않아 향수별 비중의 합이 실제로 0.2~1.0 입니다.
     * 합이 1 이라고 가정하는 제약이 생기면 적재가 실패합니다.
     */
    @Test
    void acceptsScentFamilyWeightsThatDoNotSumToOne() {
        insertScentFamily(PERFUME_ID, REGION_ID, "0.300000");
        insertScentFamily(PERFUME_ID, OTHER_REGION_ID, "0.250000");

        Double sum = jdbcTemplate.queryForObject(
                "SELECT sum(weight) FROM perfume_scent_families WHERE perfume_id = ?",
                Double.class, PERFUME_ID);

        assertThat(sum).isEqualTo(0.55);
    }

    /** 향수 좌표는 측정 x 0~1, y 0~0.83056 이라 0~1 제약을 겁니다. */
    @Test
    void rejectsMapPointOutsideTheMap() {
        assertThatCode(() -> insertMapPoint(PERFUME_ID, 0.0, 0.83056))
                .doesNotThrowAnyException();
        assertThatThrownBy(() -> insertMapPoint(OTHER_PERFUME_ID, 0.5, 1.4))
                .isInstanceOf(DataIntegrityViolationException.class);
    }

    /**
     * 계열 영역과 라벨 위치는 향수 좌표와 좌표계가 달라 지도 바깥 여백까지 뻗어 있습니다.
     * 측정 x -0.05~1.05, y -0.04565~0.88056. 여기에 0~1 을 걸면 계열 9개가 전부 적재에 실패합니다.
     */
    @Test
    void acceptsScentRegionPolygonOutsideTheMap() {
        assertThatCode(() -> jdbcTemplate.update(
                "UPDATE scent_regions SET anchor_x = ?, anchor_y = ?, polygon = ?::jsonb"
                        + " WHERE scent_region_id = ?",
                -0.05, -0.04565, "[[[-0.05,-0.04565],[1.05,0.88056],[0.5,0.5]]]", REGION_ID))
                .doesNotThrowAnyException();

        String polygon = jdbcTemplate.queryForObject(
                "SELECT polygon::text FROM scent_regions WHERE scent_region_id = ?",
                String.class, REGION_ID);

        assertThat(polygon).contains("-0.05");
    }

    /** 향수를 CSV 와 다시 이어붙일 유일한 키라, 두 향수가 같은 번호를 가지면 안 됩니다. */
    @Test
    void rejectsDuplicateFragranticaId() {
        assertThatThrownBy(() -> jdbcTemplate.update(
                "UPDATE perfumes SET fragrantica_id = 900001 WHERE perfume_id = ?", OTHER_PERFUME_ID))
                .isInstanceOf(DataIntegrityViolationException.class);
    }

    /**
     * 닮은 향수는 방향이 있는 관계입니다. a 의 10위 안에 b 가 있어도 b 의 10위 안에 a 가 없을 수
     * 있어 실제 데이터 2000행 중 810행이 한쪽 방향뿐입니다. 순서 없는 쌍으로 접으면 그만큼 사라집니다.
     */
    @Test
    void storesNeighborsInBothDirectionsSeparately() {
        insertNeighbor(PERFUME_ID, OTHER_PERFUME_ID, 1, "0.7797");
        insertNeighbor(OTHER_PERFUME_ID, PERFUME_ID, 4, "0.2021");

        Integer count = jdbcTemplate.queryForObject(
                "SELECT count(*) FROM perfume_neighbors WHERE perfume_id IN (?, ?)",
                Integer.class, PERFUME_ID, OTHER_PERFUME_ID);

        assertThat(count).isEqualTo(2);
    }

    /**
     * 대표 계열은 perfume_scent_families 에서 비중이 가장 큰 행입니다. perfume_map_points 에
     * 대표를 담는 컬럼이 다시 생기면 값이 두 군데가 되어 적재가 한쪽만 갱신했을 때 어긋납니다.
     */
    @Test
    void mapPointDoesNotCarryARepresentativeScentRegion() {
        Integer columns = jdbcTemplate.queryForObject(
                "SELECT count(*) FROM information_schema.columns"
                        + " WHERE table_name = 'perfume_map_points' AND column_name = 'scent_region_id'",
                Integer.class);

        assertThat(columns).isZero();
    }

    private void insertPerfume(long perfumeId, String name, long fragranticaId) {
        jdbcTemplate.update(
                "INSERT INTO perfumes (perfume_id, brand_id, name, fragrantica_id, is_active)"
                        + " VALUES (?, ?, ?, ?, true)",
                perfumeId, BRAND_ID, name, fragranticaId);
    }

    private void insertScentRegion(long scentRegionId, String code) {
        jdbcTemplate.update(
                "INSERT INTO scent_regions (scent_region_id, code, name, is_active)"
                        + " VALUES (?, ?, ?, true)",
                scentRegionId, code, code);
    }

    private void insertScentFamily(long perfumeId, long scentRegionId, String weight) {
        jdbcTemplate.update(
                "INSERT INTO perfume_scent_families (perfume_id, scent_region_id, weight)"
                        + " VALUES (?, ?, ?::numeric)",
                perfumeId, scentRegionId, weight);
    }

    private void insertMapPoint(long perfumeId, double mapX, double mapY) {
        jdbcTemplate.update(
                "INSERT INTO perfume_map_points (perfume_id, map_x, map_y) VALUES (?, ?, ?)",
                perfumeId, mapX, mapY);
    }

    private void insertNeighbor(long perfumeId, long neighborPerfumeId, int rank, String similarity) {
        jdbcTemplate.update(
                "INSERT INTO perfume_neighbors (perfume_id, neighbor_perfume_id, rank, similarity)"
                        + " VALUES (?, ?, ?, ?::numeric)",
                perfumeId, neighborPerfumeId, rank, similarity);
    }

    private void clearFixtures() {
        jdbcTemplate.update("DELETE FROM perfume_neighbors WHERE perfume_id IN (?, ?)",
                PERFUME_ID, OTHER_PERFUME_ID);
        jdbcTemplate.update("DELETE FROM perfume_scent_families WHERE perfume_id IN (?, ?)",
                PERFUME_ID, OTHER_PERFUME_ID);
        jdbcTemplate.update("DELETE FROM perfume_map_points WHERE perfume_id IN (?, ?)",
                PERFUME_ID, OTHER_PERFUME_ID);
        jdbcTemplate.update("DELETE FROM perfumes WHERE perfume_id IN (?, ?)",
                PERFUME_ID, OTHER_PERFUME_ID);
        jdbcTemplate.update("DELETE FROM brands WHERE brand_id = ?", BRAND_ID);
        jdbcTemplate.update("DELETE FROM scent_regions WHERE scent_region_id IN (?, ?)",
                REGION_ID, OTHER_REGION_ID);
    }
}
