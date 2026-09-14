package com.hyanghae.backend.perfume;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.hyanghae.backend.support.IntegrationTest;
import org.hamcrest.Matchers;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

/**
 * 브랜드 목록 API 를 실제 PostgreSQL 위에서 검증합니다.
 *
 * <p><b>정렬이 이 테스트의 본론입니다.</b> 한국어 가나다순은 데이터베이스 기본 collation 으로는
 * 나오지 않습니다. {@code en_US.utf8} 에는 한글 규칙이 없어 '디올' 다음에 '딥디크' 가 오지 않고
 * 엉뚱한 자리로 밀립니다. 그래서 {@code COLLATE "C"} 를 쓰는데, 그것이 실제로 가나다순을 내는지
 * 사람이 눈으로 확인할 수 있는 자료를 넣어 봅니다.
 *
 * <p>브랜드 이름은 실제 데이터를 본떠 씁니다. 지금 71개가 모두 영문이고 한국어 이름은 아직
 * 채워지지 않았으므로, 한쪽만 있는 브랜드도 함께 심습니다.
 */
@IntegrationTest
@AutoConfigureMockMvc
@ActiveProfiles({"manual-test", "test"})
class BrandListIntegrationTest {

    private static final String BRANDS_URL = "/api/v1/brands";

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Autowired
    private ObjectMapper objectMapper;

    @BeforeEach
    void insertFixtures() {
        clearData();

        // 한국어 이름이 '디올 < 딥디크' 순으로 갈리는 두 브랜드를 일부러 넣습니다. 기본 collation
        // 으로는 이 둘의 순서가 뒤집힙니다.
        insertBrand(1, "Dior", "디올", "https://img.example.com/dior.png", true);
        insertBrand(2, "Diptyque", "딥디크", null, true);
        insertBrand(3, "Chanel", "샤넬", null, true);
        insertBrand(4, "Byredo", null, null, true);
        insertBrand(5, "Retired House", "내려간 브랜드", null, false);

        // Dior 에 활성 둘·비활성 하나. 비활성이 세어지면 3 이 됩니다.
        insertPerfume(1, 1, "Sauvage", true);
        insertPerfume(2, 1, "Homme", true);
        insertPerfume(3, 1, "Retired Scent", false);

        insertPerfume(4, 2, "Do Son", true);

        // Chanel 에 비활성만 둘. 이것이 세어지면 향수 많은 순에서 Chanel 이 Diptyque 를
        // 앞지릅니다. 활성만 세면 0 이라 맨 뒤입니다.
        insertPerfume(6, 3, "Chanel Retired A", false);
        insertPerfume(7, 3, "Chanel Retired B", false);

        insertPerfume(5, 5, "Gone", true);
        // Chanel 과 Byredo 는 향수가 없습니다. 그래도 목록에 나와야 합니다.
    }

    @AfterEach
    void cleanUp() {
        clearData();
    }

    // ────────────────────────────────────────────────────────────────
    // 목록
    // ────────────────────────────────────────────────────────────────

    /** 카드 한 장에 실릴 값이 모두 나갑니다. */
    @Test
    void putsEveryFieldInEachCard() throws Exception {
        mockMvc.perform(get(BRANDS_URL).param("keyword", "Dior"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.brands.length()").value(1))
                .andExpect(jsonPath("$.brands[0].brandId").value(1))
                .andExpect(jsonPath("$.brands[0].name").value("Dior"))
                .andExpect(jsonPath("$.brands[0].nameKo").value("디올"))
                .andExpect(jsonPath("$.brands[0].logoUrl")
                        .value("https://img.example.com/dior.png"))
                .andExpect(jsonPath("$.brands[0].perfumeCount").doesNotHaveJsonPath());
    }

    /**
     * 향수가 하나도 없는 브랜드도 목록에 나옵니다.
     *
     * <p>브랜드 페이지는 카탈로그입니다. 향수가 잠깐 0이 됐다고 브랜드가 사라지면 이상합니다.
     *
     * <p><b>향수 많은 순에서도 확인합니다.</b> 그 정렬만 향수를 조인하는데, 안쪽 조인으로 두면
     * 향수가 없는 브랜드가 통째로 빠집니다. 이름순은 아예 조인하지 않아 이 실수가 드러나지
     * 않습니다.
     */
    @Test
    void keepsBrandsWithoutAnyPerfume() throws Exception {
        for (String sort : new String[]{"NAME_EN", "PERFUME_COUNT"}) {
            mockMvc.perform(get(BRANDS_URL).param("sort", sort))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.brands.length()").value(4))
                    .andExpect(jsonPath("$.brands[*].name")
                            .value(Matchers.hasItems("Chanel", "Byredo")));
        }
    }

    /** 내려간 브랜드는 목록에 나오지 않습니다. */
    @Test
    void hidesInactiveBrands() throws Exception {
        mockMvc.perform(get(BRANDS_URL))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.brands.length()").value(4))
                .andExpect(jsonPath("$.brands[*].name")
                        .value(Matchers.not(Matchers.hasItem("Retired House"))))
                .andExpect(jsonPath("$.brands[*].name").value(Matchers.hasItem("Dior")));
    }

    /**
     * 한국어 이름과 로고가 없는 브랜드는 그 자리가 <b>{@code null} 로</b> 나갑니다.
     *
     * <p>필드가 빠지는 것과 {@code null} 이 담기는 것은 다릅니다. 화면이 {@code 'nameKo' in brand}
     * 로 확인한다면 두 경우의 답이 갈립니다. 그래서 "있는데 비었다" 를 못박아 둡니다.
     *
     * <p>{@code jsonPath(...).doesNotExist()} 로는 이것을 확인할 수 없습니다. 그 단언은 값이
     * 없을 때와 {@code null} 일 때를 모두 통과시킵니다.
     */
    @Test
    void leavesKoreanNameAndLogoNullWhenMissing() throws Exception {
        String body = mockMvc.perform(get(BRANDS_URL).param("keyword", "Byredo"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.brands[0].name").value("Byredo"))
                .andReturn()
                .getResponse()
                .getContentAsString();

        JsonNode brand = objectMapper.readTree(body).get("brands").get(0);

        assertThat(brand.has("nameKo")).isTrue();
        assertThat(brand.get("nameKo").isNull()).isTrue();
        assertThat(brand.has("logoUrl")).isTrue();
        assertThat(brand.get("logoUrl").isNull()).isTrue();
    }

    /** 브랜드가 없으면 빈 배열입니다. {@code null} 이 아닙니다. */
    @Test
    void returnsAnEmptyArrayWhenNothingMatches() throws Exception {
        mockMvc.perform(get(BRANDS_URL).param("keyword", "없는 브랜드"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.brands").isArray())
                .andExpect(jsonPath("$.brands").isEmpty());
    }

    // ────────────────────────────────────────────────────────────────
    // 정렬
    // ────────────────────────────────────────────────────────────────

    /**
     * 한국어 이름순이 <b>가나다순</b>입니다.
     *
     * <p>이 테스트가 이 기능의 핵심입니다. 데이터베이스 기본 collation({@code en_US.utf8})에는
     * 한글 규칙이 없어 '디올 · 샤넬 · 딥디크' 처럼 어긋납니다. {@code COLLATE "C"} 는 코드포인트
     * 순인데, 완성형 한글이 초성→중성→종성 순으로 배열되어 있어 그것이 곧 가나다순입니다.
     *
     * <p>'디올' 과 '딥디크' 를 함께 넣은 이유가 여기 있습니다. 둘은 초성이 같고 중성에서 갈리는데,
     * 기본 collation 이 정확히 이 자리에서 틀립니다.
     *
     * <p>한국어 이름이 없는 Byredo 는 맨 뒤입니다.
     */
    @Test
    void sortsByKoreanNameInDictionaryOrder() throws Exception {
        mockMvc.perform(get(BRANDS_URL).param("sort", "NAME_KO"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.brands[*].name")
                        .value(Matchers.contains("Dior", "Diptyque", "Chanel", "Byredo")))
                .andExpect(jsonPath("$.brands[*].nameKo")
                        .value(Matchers.contains("디올", "딥디크", "샤넬", null)));
    }

    /**
     * 영어 이름순은 <b>대소문자를 가리지 않습니다.</b>
     *
     * <p>여기에 {@code COLLATE "C"} 를 쓰면 대문자가 전부 앞으로 가서 'Zara' 가 'adidas' 보다
     * 앞에 옵니다. 기본 collation 이 맞는 자리입니다.
     */
    @Test
    void sortsByEnglishNameIgnoringCase() throws Exception {
        insertBrand(6, "adidas", null, null, true);
        insertBrand(7, "Zara", null, null, true);

        mockMvc.perform(get(BRANDS_URL).param("sort", "NAME_EN"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.brands[*].name")
                        .value(Matchers.contains(
                                "adidas", "Byredo", "Chanel", "Dior", "Diptyque", "Zara")));
    }

    /**
     * 향수 많은 순입니다. 같은 수는 영문 이름순으로 갈립니다.
     *
     * <p><b>내려간 향수는 세지 않습니다.</b> 응답에 수가 실리지 않으므로 순서로 확인합니다.
     * Dior 는 활성 둘·비활성 하나, Chanel 은 비활성만 둘입니다. 비활성까지 세면 Chanel 이 2 가
     * 되어 Diptyque(1) 를 앞지르는데, 활성만 세면 0 이라 맨 뒤로 갑니다.
     *
     * <p>0 인 브랜드가 둘이라 영문 이름으로 갈립니다. 뒤 기준이 없으면 이 둘의 순서가 요청마다
     * 달라집니다.
     */
    @Test
    void sortsByPerfumeCountIgnoringInactivePerfumes() throws Exception {
        mockMvc.perform(get(BRANDS_URL).param("sort", "PERFUME_COUNT"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.brands[*].name")
                        .value(Matchers.contains("Dior", "Diptyque", "Byredo", "Chanel")));
    }

    /** 정렬을 주지 않으면 영어 이름순입니다. */
    @Test
    void defaultsToEnglishName() throws Exception {
        mockMvc.perform(get(BRANDS_URL))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.brands[0].name").value("Byredo"));
    }

    /** 목록에 없는 정렬 기준은 400 입니다. Spring 이 값을 못 바꿔 서비스까지 오지 않습니다. */
    @Test
    void rejectsUnknownSort() throws Exception {
        mockMvc.perform(get(BRANDS_URL).param("sort", "ROMANIZED"))
                .andExpect(status().isBadRequest());
    }

    // ────────────────────────────────────────────────────────────────
    // 검색
    // ────────────────────────────────────────────────────────────────

    /** 검색어는 한국어와 영문 이름 <b>모두</b>에서 찾습니다. 검색창이 하나이기 때문입니다. */
    @Test
    void searchesBothNames() throws Exception {
        mockMvc.perform(get(BRANDS_URL).param("keyword", "디"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.brands[*].name")
                        .value(Matchers.contains("Dior", "Diptyque")));

        mockMvc.perform(get(BRANDS_URL).param("keyword", "Dip"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.brands[*].name").value(Matchers.contains("Diptyque")));
    }

    /** 대소문자를 가리지 않고 부분 일치입니다. */
    @Test
    void searchesCaseInsensitively() throws Exception {
        mockMvc.perform(get(BRANDS_URL).param("keyword", "cHaNe"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.brands[*].name").value(Matchers.contains("Chanel")));
    }

    /** 빈 검색어는 조건을 걸지 않습니다. 공백만 보내도 마찬가지입니다. */
    @Test
    void treatsBlankKeywordAsNoFilter() throws Exception {
        for (String keyword : new String[]{"", "   "}) {
            mockMvc.perform(get(BRANDS_URL).param("keyword", keyword))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.brands.length()").value(4));
        }
    }

    /**
     * 와일드카드 문자를 쳐도 전체가 걸리지 않습니다.
     *
     * <p>{@code %} 와 {@code _} 는 {@code LIKE} 에서 "아무 글자" 를 뜻합니다. 그대로 넘기면
     * {@code %} 한 글자를 친 사람에게 전체 목록이 나가고, {@code _} 를 친 사람에게는 이름이 전부
     * 걸립니다. 검색이 검색이 아니게 됩니다.
     *
     * <p>{@code %} 를 쳤을 때 빈 목록을 기대하지 <b>않습니다.</b> 이름에 진짜 {@code %} 가 든
     * 브랜드가 있으면 그것은 걸려야 맞습니다. 확인할 것은 "전체가 걸리지 않는다" 와 "글자 그대로
     * 찾는다" 둘입니다.
     */
    @Test
    void escapesWildcardCharactersInTheKeyword() throws Exception {
        insertBrand(8, "100% Pure", null, null, true);

        // 와일드카드였다면 다섯이 모두 걸립니다. 글자로 읽으면 이름에 % 가 든 하나뿐입니다.
        mockMvc.perform(get(BRANDS_URL).param("keyword", "%"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.brands[*].name").value(Matchers.contains("100% Pure")));

        // 밑줄과 역슬래시를 가진 브랜드는 없습니다. 와일드카드였다면 전부 걸립니다.
        for (String keyword : new String[]{"_", "\\"}) {
            mockMvc.perform(get(BRANDS_URL).param("keyword", keyword))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.brands").isEmpty());
        }

        mockMvc.perform(get(BRANDS_URL).param("keyword", "100%"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.brands[*].name").value(Matchers.contains("100% Pure")));
    }

    // ────────────────────────────────────────────────────────────────
    // 문서
    // ────────────────────────────────────────────────────────────────

    /** API 문서에 실립니다. 문서 애노테이션은 코드와 달라져도 컴파일러가 잡아주지 않습니다. */
    @Test
    void documentsTheEndpoint() throws Exception {
        mockMvc.perform(get("/v3/api-docs"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.paths['/api/v1/brands'].get").exists());
    }

    // ────────────────────────────────────────────────────────────────
    // 도우미
    // ────────────────────────────────────────────────────────────────

    private void insertBrand(long id, String name, String nameKo, String logoUrl, boolean active) {
        jdbcTemplate.update("""
                INSERT INTO brands (brand_id, name, name_ko, logo_url, is_active)
                VALUES (?, ?, ?, ?, ?)
                """, id, name, nameKo, logoUrl, active);
    }

    private void insertPerfume(long id, long brandId, String name, boolean active) {
        jdbcTemplate.update("""
                INSERT INTO perfumes (perfume_id, brand_id, name, is_active)
                VALUES (?, ?, ?, ?)
                """, id, brandId, name, active);
    }

    private void clearData() {
        jdbcTemplate.update("DELETE FROM perfumes");
        jdbcTemplate.update("DELETE FROM brands");
    }
}
