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
 * 향수 응답의 브랜드 한국어 이름과 {@code brandId} 필터를 검증합니다.
 *
 * <p>화면이 카드와 상세에서 <b>한국어를 크게, 영문을 작게</b> 그립니다(와이어프레임 A33). 지금까지
 * 향수 응답에는 영문 브랜드명만 있어 한글 사이에 영문이 끼어 보였습니다.
 *
 * <p>브랜드 필터도 함께 봅니다. 이름 완전 일치만 있던 자리에 번호를 더했습니다. 브랜드 이름은
 * 한글과 영문이 섞여 있고 표기만 다른 중복도 있어, 화면이 가진 이름이 저장된 이름과 어긋날 수
 * 있습니다.
 *
 * <p>고정 데이터는 이렇습니다.
 *
 * <ul>
 *   <li>브랜드 1 {@code Chanel} / 샤넬 — 한국어 이름이 있습니다.
 *   <li>브랜드 2 {@code Diptyque} — 한국어 이름이 <b>없습니다.</b> 아직 못 채운 브랜드가 있고,
 *       표기만 다른 중복 브랜드는 한쪽만 한국어 이름을 갖습니다.
 *   <li>브랜드 3 {@code Le Labo} / 르 라보 — 한국어 이름이 <b>어느 향수 이름에도 없습니다.</b>
 *       검색어가 브랜드 한국어 이름에만 걸리는지 보려면 이런 브랜드가 필요합니다. 샤넬로는
 *       확인되지 않습니다. 향수 1번의 이름이 "블루 드 샤넬"이라 브랜드를 보지 않아도 걸립니다.
 * </ul>
 */
@IntegrationTest
@AutoConfigureMockMvc
class PerfumeBrandKoreanNameIntegrationTest {

    private static final String SEARCH_URL = "/api/v1/perfumes";
    private static final String DETAIL_URL = "/api/v1/perfumes/{perfumeId}";

    private static final long CHANEL = 1;
    private static final long DIPTYQUE = 2;
    private static final long LE_LABO = 3;

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @BeforeEach
    void insertFixtures() {
        clearData();

        insertBrand(CHANEL, "Chanel", "샤넬");
        insertBrand(DIPTYQUE, "Diptyque", null);
        insertBrand(LE_LABO, "Le Labo", "르 라보");

        insertPerfume(1, CHANEL, "Bleu de Chanel", "블루 드 샤넬");
        insertPerfume(2, CHANEL, "Chance", "챤스");
        insertPerfume(3, DIPTYQUE, "Do Son", "두 손");
        insertPerfume(4, null, "Orphan Scent", null);
        insertPerfume(5, LE_LABO, "Santal 33", "산탈 33");
    }

    @AfterEach
    void cleanUp() {
        clearData();
    }

    /** 목록 카드에 브랜드 이름이 <b>둘 다</b> 실립니다. */
    @Test
    void putsBothBrandNamesInTheCard() throws Exception {
        mockMvc.perform(get(SEARCH_URL).param("keyword", "Bleu de Chanel"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.perfumes[0].name").value("Bleu de Chanel"))
                .andExpect(jsonPath("$.perfumes[0].nameKo").value("블루 드 샤넬"))
                .andExpect(jsonPath("$.perfumes[0].brandName").value("Chanel"))
                .andExpect(jsonPath("$.perfumes[0].brandNameKo").value("샤넬"));
    }

    /**
     * 상세의 중첩 브랜드에도 한국어 이름이 실립니다.
     *
     * <p>목록과 상세가 다른 쿼리라 따로 확인합니다. 한쪽만 고치면 카드에서는 한글이 나오는데
     * 상세로 들어가면 영문으로 바뀝니다.
     */
    @Test
    void putsBrandKoreanNameInTheDetail() throws Exception {
        mockMvc.perform(get(DETAIL_URL, 1))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.brand.brandId").value((int) CHANEL))
                .andExpect(jsonPath("$.brand.name").value("Chanel"))
                .andExpect(jsonPath("$.brand.nameKo").value("샤넬"));
    }

    /**
     * 한국어 이름이 없으면 비어 나갑니다. <b>영문으로 채우지 않습니다.</b>
     *
     * <p>서버가 대신 채우면 화면은 그 값이 진짜 한국어 이름인지 알 수 없습니다. 비워 보내면
     * 화면이 영문으로 그릴지 다르게 그릴지 정할 수 있습니다.
     */
    @Test
    void leavesBrandKoreanNameEmptyWhenMissing() throws Exception {
        mockMvc.perform(get(SEARCH_URL).param("keyword", "Do Son"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.perfumes[0].brandName").value("Diptyque"))
                .andExpect(jsonPath("$.perfumes[0].brandNameKo").doesNotExist());

        mockMvc.perform(get(DETAIL_URL, 3))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.brand.name").value("Diptyque"))
                .andExpect(jsonPath("$.brand.nameKo").doesNotExist());
    }

    /** 브랜드가 없는 향수는 브랜드 자체가 비어 있습니다. 한국어 이름을 더해도 그대로입니다. */
    @Test
    void keepsBrandNullForPerfumesWithoutOne() throws Exception {
        mockMvc.perform(get(SEARCH_URL).param("keyword", "Orphan"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.perfumes[0].brandName").doesNotExist())
                .andExpect(jsonPath("$.perfumes[0].brandNameKo").doesNotExist());

        mockMvc.perform(get(DETAIL_URL, 4))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.brand").doesNotExist());
    }

    /** {@code brandId} 로 그 브랜드의 향수만 걸립니다. */
    @Test
    void filtersByBrandId() throws Exception {
        mockMvc.perform(get(SEARCH_URL).param("brandId", String.valueOf(CHANEL)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.perfumes.length()").value(2))
                .andExpect(jsonPath("$.perfumes[*].brandName").value(
                        org.hamcrest.Matchers.everyItem(org.hamcrest.Matchers.is("Chanel"))));

        mockMvc.perform(get(SEARCH_URL).param("brandId", String.valueOf(DIPTYQUE)))
                .andExpect(jsonPath("$.perfumes.length()").value(1))
                .andExpect(jsonPath("$.perfumes[0].name").value("Do Son"));
    }

    /**
     * 없는 브랜드 번호는 빈 목록입니다. 404 가 아닙니다.
     *
     * <p>검색 조건이 아무것도 안 걸린 결과와 같은 모양이라, 화면이 "결과 없음" 한 가지로 다룹니다.
     */
    @Test
    void answersEmptyForUnknownBrandId() throws Exception {
        mockMvc.perform(get(SEARCH_URL).param("brandId", "999999"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.perfumes.length()").value(0));
    }

    /** 이름 필터와 번호 필터를 함께 주면 AND 입니다. 어긋나면 결과가 없습니다. */
    @Test
    void combinesBrandNameAndBrandId() throws Exception {
        mockMvc.perform(get(SEARCH_URL)
                        .param("brand", "Chanel")
                        .param("brandId", String.valueOf(CHANEL)))
                .andExpect(jsonPath("$.perfumes.length()").value(2));

        mockMvc.perform(get(SEARCH_URL)
                        .param("brand", "Chanel")
                        .param("brandId", String.valueOf(DIPTYQUE)))
                .andExpect(jsonPath("$.perfumes.length()").value(0));
    }

    /**
     * 집계 정렬에도 두 값이 똑같이 걸립니다.
     *
     * <p>{@code ranking} 이 있으면 <b>다른 쿼리</b>가 돕니다. 한쪽만 고치면 정렬 칩을 누르는
     * 순간 브랜드 한국어 이름이 사라지고 번호 필터도 풀립니다.
     */
    @Test
    void appliesToRankingQueryToo() throws Exception {
        insertShelfItem(1, 1);
        insertShelfItem(2, 1);
        insertShelfItem(3, 1);

        mockMvc.perform(get(SEARCH_URL).param("ranking", "OWNED"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.perfumes[0].brandName").value("Chanel"))
                .andExpect(jsonPath("$.perfumes[0].brandNameKo").value("샤넬"));

        mockMvc.perform(get(SEARCH_URL)
                        .param("ranking", "OWNED")
                        .param("brandId", String.valueOf(DIPTYQUE)))
                .andExpect(jsonPath("$.perfumes.length()").value(0));
    }

    /**
     * 브랜드 한국어 이름으로도 향수가 검색됩니다.
     *
     * <p>영문 이름만 보던 때는 "르 라보"가 0건이었습니다. 한국어 서비스에서 브랜드를 한글로 치는
     * 것이 자연스러운 입력인데, 사용자에게는 그 브랜드가 없는 것으로 보였습니다.
     *
     * <p>브랜드 3번으로 확인합니다. 샤넬로는 이 동작이 검증되지 않습니다. 향수 1번의 한국어
     * 이름이 "블루 드 샤넬"이라 브랜드를 보지 않아도 걸려서, 고치기 전에도 통과합니다.
     */
    @Test
    void findsPerfumesByBrandKoreanName() throws Exception {
        mockMvc.perform(get(SEARCH_URL).param("keyword", "르 라보"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(1))
                .andExpect(jsonPath("$.perfumes[0].perfumeId").value(5))
                .andExpect(jsonPath("$.perfumes[0].brandNameKo").value("르 라보"));
    }

    /**
     * 브랜드 한국어 이름도 부분 일치입니다.
     *
     * <p>다른 이름들과 같은 규칙입니다. 실제 데이터가 이것을 요구합니다 — 사용자는 "조 말론"을
     * 치지만 저장된 이름은 "조 말론 런던"입니다. 완전 일치면 그 검색이 다시 0건이 됩니다.
     */
    @Test
    void findsPerfumesByPartialBrandKoreanName() throws Exception {
        mockMvc.perform(get(SEARCH_URL).param("keyword", "라보"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(1))
                .andExpect(jsonPath("$.perfumes[0].perfumeId").value(5));
    }

    /**
     * 집계 정렬에도 브랜드 한국어 이름이 걸립니다.
     *
     * <p>{@code ranking} 이 있으면 <b>다른 쿼리</b>가 돕니다. 검색 조건이 두 벌이라 한쪽만
     * 고치면 정렬 칩을 누르는 순간 같은 검색어가 0건이 됩니다.
     */
    @Test
    void findsByBrandKoreanNameInRankingQueryToo() throws Exception {
        insertShelfItem(1, 5);
        insertShelfItem(2, 5);
        insertShelfItem(3, 5);

        mockMvc.perform(get(SEARCH_URL)
                        .param("ranking", "OWNED")
                        .param("keyword", "르 라보"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(1))
                .andExpect(jsonPath("$.perfumes[0].perfumeId").value(5));
    }

    /**
     * 띄어쓰기를 가리지 않습니다. 브랜드 이름과 향수 이름 <b>모두</b>입니다.
     *
     * <p>어디서 띄는지는 사람마다 다른데 저장된 이름은 한 가지입니다. "르라보" 로 붙여 친 사람이
     * 0건을 받고 있었습니다.
     *
     * <p>브랜드 3번이 {@code Le Labo} / "르 라보" 라 영문과 한국어를 한 자리에서 봅니다. 향수
     * 이름은 1번 "블루 드 샤넬" 로 봅니다 — 브랜드('샤넬')에는 공백이 없어, 이 검색이 걸리는
     * 이유가 향수 이름 쪽임이 분명합니다.
     */
    @Test
    void ignoresSpacesInNames() throws Exception {
        // 브랜드 이름 — 한국어와 영문 모두
        for (String keyword : new String[]{"르라보", "르 라보", "lelabo", "Le Labo"}) {
            mockMvc.perform(get(SEARCH_URL).param("keyword", keyword))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.totalElements").value(1))
                    .andExpect(jsonPath("$.perfumes[0].perfumeId").value(5));
        }

        // 향수 이름
        for (String keyword : new String[]{"블루드샤넬", "블루 드 샤넬", "bleudechanel"}) {
            mockMvc.perform(get(SEARCH_URL).param("keyword", keyword))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.totalElements").value(1))
                    .andExpect(jsonPath("$.perfumes[0].perfumeId").value(1));
        }

        // 이름에 공백이 없고 검색어에만 있는 방향. 검색어에서만 지우면 이쪽이 도로 0건입니다.
        mockMvc.perform(get(SEARCH_URL).param("keyword", "챤 스"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(1))
                .andExpect(jsonPath("$.perfumes[0].perfumeId").value(2));
    }

    /**
     * 한국어 브랜드와 이름을 같이 친 검색어도 찾습니다. 어디서 띄든, 영문 이름을 섞어 치든 같습니다.
     *
     * <p>영문으로 같이 친 경우는 {@code PerfumeSearchIntegrationTest} 가 봅니다. 한국어는 브랜드 ·
     * 이름이 이은 줄의 앞쪽에 공백 없이 붙어 있어 '르 라보 산탈 33' 이 통째로 걸리고, 한국어
     * 브랜드에 영문 이름을 섞은 말은 이은 줄에서 떨어져 있어 낱말마다 보는 길로 걸립니다.
     * 순위 검색은 조건이 따로 한 벌이라 같이 봅니다.
     */
    @Test
    void findsKoreanBrandAndNameTypedTogether() throws Exception {
        for (String keyword : new String[]{"르 라보 산탈 33", "르라보산탈33", "르라보 santal 33"}) {
            mockMvc.perform(get(SEARCH_URL).param("keyword", keyword))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.totalElements").value(1))
                    .andExpect(jsonPath("$.perfumes[0].perfumeId").value(5));
        }

        insertShelfItem(1, 5);
        insertShelfItem(2, 5);
        insertShelfItem(3, 5);
        mockMvc.perform(get(SEARCH_URL)
                        .param("ranking", "OWNED")
                        .param("keyword", "르라보 산탈33"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(1))
                .andExpect(jsonPath("$.perfumes[0].perfumeId").value(5));
    }

    /**
     * 집계 정렬에서도 띄어쓰기를 가리지 않습니다.
     *
     * <p>검색 조건이 두 벌이라 한쪽만 고치면 정렬 칩을 누르는 순간 같은 검색어가 0건이 됩니다.
     * {@link #findsByBrandKoreanNameInRankingQueryToo} 와 같은 사정입니다.
     */
    @Test
    void ignoresSpacesInRankingQueryToo() throws Exception {
        insertShelfItem(1, 5);
        insertShelfItem(2, 5);
        insertShelfItem(3, 5);

        for (String keyword : new String[]{"르라보", "lelabo"}) {
            mockMvc.perform(get(SEARCH_URL)
                            .param("ranking", "OWNED")
                            .param("keyword", keyword))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.totalElements").value(1))
                    .andExpect(jsonPath("$.perfumes[0].perfumeId").value(5));
        }
    }

    /**
     * 한국어 이름이 없는 브랜드가 섞여 있어도 검색이 깨지지 않습니다.
     *
     * <p>{@code LEFT JOIN} 이라 브랜드가 없는 향수도, 한국어 이름이 비어 있는 브랜드도 있습니다.
     * 새 조건이 그 행들을 떨어뜨리거나 잘못 끌어오지 않는지 봅니다.
     */
    @Test
    void keepsSearchingBrandsWithoutKoreanName() throws Exception {
        mockMvc.perform(get(SEARCH_URL).param("keyword", "Diptyque"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(1))
                .andExpect(jsonPath("$.perfumes[0].perfumeId").value(3))
                .andExpect(jsonPath("$.perfumes[0].brandNameKo").doesNotExist());

        mockMvc.perform(get(SEARCH_URL).param("keyword", "Orphan"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(1))
                .andExpect(jsonPath("$.perfumes[0].perfumeId").value(4));
    }

    private void insertBrand(long id, String name, String nameKo) {
        jdbcTemplate.update(
                "INSERT INTO brands (brand_id, name, name_ko, is_active) VALUES (?, ?, ?, true)",
                id, name, nameKo);
    }

    private void insertPerfume(long id, Long brandId, String name, String nameKo) {
        jdbcTemplate.update(
                "INSERT INTO perfumes (perfume_id, brand_id, name, name_ko, is_active)"
                        + " VALUES (?, ?, ?, ?, true)",
                id, brandId, name, nameKo);
    }

    /** 담은 사람 수로 줄 세우는 정렬은 세 명 이상이 담은 향수만 내놓습니다. */
    private void insertShelfItem(long userId, long perfumeId) {
        jdbcTemplate.update(
                "INSERT INTO users (user_id, email, password_hash, nickname) VALUES (?, ?, 'x', ?)",
                userId, "u" + userId + "@hyanghae.com", "사용자" + userId);
        jdbcTemplate.update(
                "INSERT INTO user_perfumes (user_id, perfume_id, ownership_status)"
                        + " VALUES (?, ?, 'OWNED')",
                userId, perfumeId);
    }

    private void clearData() {
        jdbcTemplate.update("DELETE FROM user_perfumes");
        jdbcTemplate.update("DELETE FROM user_perfume_views");
        jdbcTemplate.update("DELETE FROM users");
        jdbcTemplate.update("DELETE FROM perfumes");
        jdbcTemplate.update("DELETE FROM brands");
    }
}
