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
 * </ul>
 */
@IntegrationTest
@AutoConfigureMockMvc
class PerfumeBrandKoreanNameIntegrationTest {

    private static final String SEARCH_URL = "/api/v1/perfumes";
    private static final String DETAIL_URL = "/api/v1/perfumes/{perfumeId}";

    private static final long CHANEL = 1;
    private static final long DIPTYQUE = 2;

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @BeforeEach
    void insertFixtures() {
        clearData();

        insertBrand(CHANEL, "Chanel", "샤넬");
        insertBrand(DIPTYQUE, "Diptyque", null);

        insertPerfume(1, CHANEL, "Bleu de Chanel", "블루 드 샤넬");
        insertPerfume(2, CHANEL, "Chance", "챤스");
        insertPerfume(3, DIPTYQUE, "Do Son", "두 손");
        insertPerfume(4, null, "Orphan Scent", null);
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
