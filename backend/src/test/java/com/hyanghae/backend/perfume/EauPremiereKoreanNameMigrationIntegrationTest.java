package com.hyanghae.backend.perfume;

import static org.assertj.core.api.Assertions.assertThat;

import com.hyanghae.backend.support.IntegrationTest;
import java.nio.charset.StandardCharsets;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.core.io.ClassPathResource;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;

/**
 * V28 이 오 프르미에르(Fragrantica 1360)의 한국어 이름을 perfume_id 와 관계없이 바로잡는지 봅니다.
 *
 * <p>테스트 DB 는 비어 있는 채로 마이그레이션을 마치므로 V28 이 이미 한 번 돌았어도 고칠 행이
 * 없었습니다. 그래서 틀린 이름의 행을 넣고 같은 스크립트를 직접 다시 돌립니다.
 *
 * <p><b>번호를 23 이 아닌 값으로 둡니다.</b> V26 이 23 에 묶여 있어 이런 환경에서 이름을 못 고친
 * 것이 이 마이그레이션을 둔 이유입니다.
 */
@IntegrationTest
@ActiveProfiles({"manual-test", "test"})
class EauPremiereKoreanNameMigrationIntegrationTest {

    private static final String SCRIPT = "db/migration/V28__correct_eau_premiere_korean_name.sql";

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @BeforeEach
    void clearPerfumes() {
        jdbcTemplate.update("DELETE FROM perfumes");
    }

    @AfterEach
    void cleanUp() {
        clearPerfumes();
    }

    @Test
    void correctsNameWhereverThePerfumeIdLands() throws Exception {
        insertPerfume(25, 1360, "Chanel N°5 Eau Premiere", "샤넬 N°5 오 프리미어");

        runMigration();

        assertThat(nameKo(25)).isEqualTo("오 프르미에르");
    }

    @Test
    void leavesOtherPerfumesAlone() throws Exception {
        insertPerfume(23, 1361, "Other Perfume", "다른 향수");

        runMigration();

        assertThat(nameKo(23)).isEqualTo("다른 향수");
    }

    /** 배포마다 다시 돌지는 않지만, 수동으로 다시 돌려도 결과가 같아야 합니다. */
    @Test
    void runningTwiceGivesTheSameResult() throws Exception {
        insertPerfume(7, 1360, "Chanel N°5 Eau Premiere", null);

        runMigration();
        runMigration();

        assertThat(nameKo(7)).isEqualTo("오 프르미에르");
    }

    private void runMigration() throws Exception {
        String sql = new ClassPathResource(SCRIPT).getContentAsString(StandardCharsets.UTF_8);
        jdbcTemplate.execute(sql);
    }

    private void insertPerfume(long perfumeId, int fragranticaId, String name, String nameKo) {
        jdbcTemplate.update(
                "INSERT INTO perfumes (perfume_id, fragrantica_id, name, name_ko) VALUES (?, ?, ?, ?)",
                perfumeId, fragranticaId, name, nameKo);
    }

    private String nameKo(long perfumeId) {
        return jdbcTemplate.queryForObject(
                "SELECT name_ko FROM perfumes WHERE perfume_id = ?", String.class, perfumeId);
    }
}
