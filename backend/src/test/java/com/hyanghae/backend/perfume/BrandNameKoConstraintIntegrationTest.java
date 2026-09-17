package com.hyanghae.backend.perfume;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.hyanghae.backend.support.IntegrationTest;
import java.util.List;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;

/**
 * 브랜드 한국어 이름의 제약을 고정합니다.
 *
 * <p><b>서로 다른 브랜드가 같은 한국어 이름을 쓸 수 있어야 합니다.</b> 리들(Lidl / Riddle),
 * 노이즈(Noyz / Noise) 처럼 실제로 다른 브랜드가 21그룹 44개 있습니다. 예전에는
 * {@code uk_brands_name_ko} 때문에 적재 스크립트가 이들을 건너뛰어 한국어 이름이 영구히
 * 비어 있었습니다.
 *
 * <p>제약을 뗀 뒤에도 <b>영문 이름은 여전히 유일해야 합니다.</b> 식별자 역할이 그쪽으로
 * 넘어갔으므로, 그것까지 풀리면 같은 브랜드가 두 줄이 됩니다.
 */
@IntegrationTest
@ActiveProfiles({"manual-test", "test"})
class BrandNameKoConstraintIntegrationTest {

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @BeforeEach
    void clearBrands() {
        jdbcTemplate.update("DELETE FROM perfumes");
        jdbcTemplate.update("DELETE FROM brands");
    }

    @AfterEach
    void cleanUp() {
        clearBrands();
    }

    /**
     * <b>이 변경의 본론입니다.</b> 한국어 이름이 겹쳐도 들어가야 합니다.
     */
    @Test
    void allowsDifferentBrandsToShareAKoreanName() {
        insertBrand("Lidl", "리들");
        insertBrand("Riddle", "리들");

        List<String> names = jdbcTemplate.queryForList(
                "SELECT name FROM brands WHERE name_ko = ? ORDER BY name", String.class, "리들");

        assertThat(names).containsExactly("Lidl", "Riddle");
    }

    /**
     * 영문 이름은 여전히 유일합니다. 한국어 쪽을 풀면서 이쪽까지 풀면 같은 브랜드가 두 줄이
     * 됩니다 — 식별자 역할이 이제 여기 하나뿐입니다.
     */
    @Test
    void stillRejectsDuplicateEnglishNames() {
        insertBrand("Chanel", "샤넬");

        assertThatThrownBy(() -> insertBrand("Chanel", "다른 표기"))
                .isInstanceOf(DuplicateKeyException.class);
    }

    /**
     * 한국어 가나다순 정렬이 그대로 나옵니다.
     *
     * <p>정렬은 {@code idx_brands_name_ko (name_ko COLLATE "C")} 가 받습니다. 제약이 만든
     * 인덱스와 <b>별개</b>라 함께 지워지지 않아야 합니다. 지워졌다면 정렬 자체는 돌지만
     * 성능이 조용히 나빠집니다 — 여기서는 순서가 맞는지만 봅니다.
     */
    @Test
    void keepsKoreanAlphabeticalOrdering() {
        insertBrand("Dior", "디올");
        insertBrand("Diptyque", "딥디크");
        insertBrand("Chanel", "샤넬");

        List<String> ordered = jdbcTemplate.queryForList(
                "SELECT name_ko FROM brands WHERE name_ko IS NOT NULL "
                        + "ORDER BY name_ko COLLATE \"C\"", String.class);

        assertThat(ordered).containsExactly("디올", "딥디크", "샤넬");
    }

    /**
     * 정렬용 인덱스가 남아 있는지 직접 봅니다. {@code DROP CONSTRAINT} 가 제약이 만든 인덱스만
     * 지우고 별도 인덱스는 건드리지 않는다는 전제를 고정합니다.
     */
    @Test
    void keepsTheSortingIndexAndTheEnglishUniqueConstraint() {
        List<String> indexes = jdbcTemplate.queryForList(
                "SELECT indexname FROM pg_indexes WHERE tablename = 'brands'", String.class);

        assertThat(indexes)
                .contains("idx_brands_name_ko", "uk_brands_name")
                .doesNotContain("uk_brands_name_ko");
    }

    private void insertBrand(String name, String nameKo) {
        jdbcTemplate.update(
                "INSERT INTO brands (name, name_ko, is_active) VALUES (?, ?, TRUE)", name, nameKo);
    }
}
