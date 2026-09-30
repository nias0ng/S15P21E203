package com.hyanghae.backend.perfume;

import static org.assertj.core.api.Assertions.assertThat;
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
 * 노트 목록·상세와 노트별 향수를 검증합니다(와이어프레임 A35 · A36).
 *
 * <p>고정 데이터는 순서와 거르기를 함께 볼 수 있게 짰습니다.
 *
 * <ul>
 *   <li>노트 1 {@code Musk} / MUSK / 순위 1 — 향수 2개. 한국어 · 영어 설명이 다 있습니다
 *   <li>노트 2 {@code Rose} / FLORAL / 순위 8 — 향수 1개. 설명이 하나도 없습니다
 *   <li>노트 3 {@code Jasmine} / FLORAL / 순위 6 — 향수 없음. 한국어 설명만 있습니다
 *   <li>노트 4 {@code Amber} / AMBER / <b>순위 없음</b> — 순위가 빈 노트가 뒤로 밀리는지.
 *       영어 설명이 공백뿐입니다
 *   <li>노트 5 {@code Retired} / MUSK — <b>내려간 노트</b>. 어디에도 나오면 안 됩니다
 * </ul>
 *
 * <p>향수 3은 비활성입니다. 노트가 붙어 있어도 목록에 나오면 안 됩니다.
 */
@IntegrationTest
@AutoConfigureMockMvc
class NoteIntegrationTest {

    private static final String NOTES_URL = "/api/v1/notes";
    private static final String NOTE_URL = "/api/v1/notes/{noteId}";
    private static final String NOTE_PERFUMES_URL = "/api/v1/notes/{noteId}/perfumes";

    private static final long MUSK = 1;
    private static final long ROSE = 2;
    private static final long JASMINE = 3;
    private static final long AMBER = 4;
    private static final long RETIRED = 5;

    private static final String MUSK_KOREAN = "포근하고 관능적인 잔향으로, 베이스를 오래 붙잡아 둡니다.";
    private static final String MUSK_ENGLISH =
            "A soft, sensual drydown that holds the base of a fragrance for a long time.";
    private static final String JASMINE_KOREAN = "풍성한 흰 꽃의 달콤함이 느껴지는 향입니다.";
    private static final String AMBER_KOREAN = "따뜻하고 달콤한 수지를 떠올리게 하는 향입니다.";

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @BeforeEach
    void insertFixtures() {
        clearData();

        insertNote(MUSK, "Musk", "머스크", "MUSK", 1, true);
        jdbcTemplate.update("UPDATE notes SET description = ? WHERE note_id = ?",
                MUSK_KOREAN, MUSK);
        jdbcTemplate.update("UPDATE notes SET description_en = ? WHERE note_id = ?",
                MUSK_ENGLISH, MUSK);
        insertNote(ROSE, "Rose", "로즈", "FLORAL", 8, true);
        insertNote(JASMINE, "Jasmine", "자스민", "FLORAL", 6, true);
        // 영어 설명이 아직 없는 노트입니다. 영어 요청에도 한국어 설명이 나가야 합니다.
        jdbcTemplate.update("UPDATE notes SET description = ? WHERE note_id = ?",
                JASMINE_KOREAN, JASMINE);
        insertNote(AMBER, "Amber", "앰버", "AMBER", null, true);
        // 영어 설명이 공백뿐인 노트입니다. 빈 값과 같게 한국어로 되돌아가야 합니다.
        jdbcTemplate.update(
                "UPDATE notes SET description = ?, description_en = ? WHERE note_id = ?",
                AMBER_KOREAN, "   ", AMBER);
        insertNote(RETIRED, "Retired", "내려감", "MUSK", 2, false);

        jdbcTemplate.update(
                "INSERT INTO brands (brand_id, name, name_ko, is_active) VALUES (1, 'Chanel', '샤넬', true)");

        insertPerfume(1, "Bleu de Chanel", "블루 드 샤넬", true);
        insertPerfume(2, "Chance", "챤스", true);
        insertPerfume(3, "Retired Scent", null, false);

        insertPerfumeNote(1, MUSK, "base");
        insertPerfumeNote(2, MUSK, "top");
        insertPerfumeNote(1, ROSE, "middle");
        insertPerfumeNote(3, MUSK, "base");   // 비활성 향수
        insertPerfumeNote(1, RETIRED, "base"); // 내려간 노트
    }

    @AfterEach
    void cleanUp() {
        clearData();
    }

    /**
     * 목록이 <b>대분류로 묶이고 그 안에서 인기 순</b>으로 나갑니다.
     *
     * <p>화면이 구역을 나눠 그리므로 같은 대분류가 흩어지면 안 됩니다. 순서가 이미 맞아 나가야
     * 화면이 이어서 끊기만 하면 됩니다.
     *
     * <p>순위가 없는 노트는 뒤로 밀립니다. {@code NULLS LAST} 를 빼면 PostgreSQL 이 오름차순에서
     * 빈 값을 맨 뒤에 두긴 하지만, 기대를 문법에 적어 두면 정렬이 바뀌어도 여기서 걸립니다.
     */
    @Test
    void ordersByFamilyThenPopularity() throws Exception {
        mockMvc.perform(get(NOTES_URL))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.notes.length()").value(4))
                .andExpect(jsonPath("$.notes[0].accordFamily").value("AMBER"))
                .andExpect(jsonPath("$.notes[0].name").value("Amber"))
                .andExpect(jsonPath("$.notes[1].accordFamily").value("FLORAL"))
                .andExpect(jsonPath("$.notes[1].name").value("Jasmine"))
                .andExpect(jsonPath("$.notes[2].accordFamily").value("FLORAL"))
                .andExpect(jsonPath("$.notes[2].name").value("Rose"))
                .andExpect(jsonPath("$.notes[3].accordFamily").value("MUSK"))
                .andExpect(jsonPath("$.notes[3].name").value("Musk"));
    }

    /** 목록 한 줄에 화면이 쓰는 값이 모두 실립니다. */
    @Test
    void putsEveryFieldInEachNote() throws Exception {
        mockMvc.perform(get(NOTES_URL))
                .andExpect(jsonPath("$.notes[3].noteId").value((int) MUSK))
                .andExpect(jsonPath("$.notes[3].name").value("Musk"))
                .andExpect(jsonPath("$.notes[3].nameKo").value("머스크"))
                .andExpect(jsonPath("$.notes[3].accordFamily").value("MUSK"))
                .andExpect(jsonPath("$.notes[3].imageUrl").value("https://cdn.test/musk.jpg"))
                .andExpect(jsonPath("$.notes[3].popularityRank").value(1));
    }

    /** 내려간 노트는 목록에도 상세에도 나오지 않습니다. */
    @Test
    void hidesRetiredNote() throws Exception {
        mockMvc.perform(get(NOTES_URL))
                .andExpect(jsonPath("$.notes[*].name").value(
                        org.hamcrest.Matchers.not(org.hamcrest.Matchers.hasItem("Retired"))));

        mockMvc.perform(get(NOTE_URL, RETIRED))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("PERFUME_NOTE_NOT_FOUND"));
    }

    /** 상세는 목록 한 줄에 <b>설명</b>이 더해진 모양입니다. */
    @Test
    void answersNoteDetail() throws Exception {
        mockMvc.perform(get(NOTE_URL, MUSK))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.noteId").value((int) MUSK))
                .andExpect(jsonPath("$.nameKo").value("머스크"))
                .andExpect(jsonPath("$.accordFamily").value("MUSK"))
                .andExpect(jsonPath("$.description")
                        .value("포근하고 관능적인 잔향으로, 베이스를 오래 붙잡아 둡니다."));
    }

    /** 영어 요청이면 영어 설명이 나갑니다. 다른 값은 언어와 관계없이 같습니다. */
    @Test
    void answersEnglishDescriptionForEnglishRequest() throws Exception {
        mockMvc.perform(get(NOTE_URL, MUSK).header("Accept-Language", "en"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.name").value("Musk"))
                .andExpect(jsonPath("$.nameKo").value("머스크"))
                .andExpect(jsonPath("$.description").value(MUSK_ENGLISH))
                .andExpect(jsonPath("$.descriptionEn").doesNotExist());
    }

    /** 한국어 요청은 영어 설명이 있어도 한국어 설명입니다. 지금까지의 응답과 같습니다. */
    @Test
    void answersKoreanDescriptionForKoreanRequest() throws Exception {
        mockMvc.perform(get(NOTE_URL, MUSK).header("Accept-Language", "ko"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.description").value(MUSK_KOREAN))
                .andExpect(jsonPath("$.descriptionEn").doesNotExist());

        // 헤더가 없거나 영어가 아닌 언어도 한국어입니다. 헤더 없는 요청은 spring.web.locale 이 정합니다.
        mockMvc.perform(get(NOTE_URL, MUSK))
                .andExpect(jsonPath("$.description").value(MUSK_KOREAN));
        mockMvc.perform(get(NOTE_URL, MUSK).header("Accept-Language", "ja-JP"))
                .andExpect(jsonPath("$.description").value(MUSK_KOREAN));
    }

    /** 영어 설명이 없는 노트는 영어 요청에도 한국어 설명으로 되돌아갑니다. 빈 설명보다 낫습니다. */
    @Test
    void fallsBackToKoreanWhenEnglishDescriptionIsMissing() throws Exception {
        mockMvc.perform(get(NOTE_URL, JASMINE).header("Accept-Language", "en"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.description").value(JASMINE_KOREAN));
    }

    /** 공백뿐인 영어 설명은 없는 것과 같습니다. 화면에 빈 설명이 나가면 안 됩니다. */
    @Test
    void fallsBackToKoreanWhenEnglishDescriptionIsBlank() throws Exception {
        mockMvc.perform(get(NOTE_URL, AMBER).header("Accept-Language", "en-US,en;q=0.9"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.description").value(AMBER_KOREAN));
    }

    /** 두 설명이 다 없는 노트는 영어 요청에도 {@code null} 입니다. */
    @Test
    void answersNullDescriptionForEnglishRequestWhenNeitherExists() throws Exception {
        String body = mockMvc.perform(get(NOTE_URL, ROSE).header("Accept-Language", "en"))
                .andExpect(status().isOk())
                .andReturn()
                .getResponse()
                .getContentAsString(java.nio.charset.StandardCharsets.UTF_8);

        com.fasterxml.jackson.databind.JsonNode note =
                new com.fasterxml.jackson.databind.ObjectMapper().readTree(body);

        assertThat(note.has("description")).isTrue();
        assertThat(note.get("description").isNull()).isTrue();
    }

    /**
     * 설명이 없는 노트는 {@code null} 입니다. 노트가 수백 개인데 설명은 채워지는 대로
     * 들어옵니다 — 화면은 비면 설명 영역을 그리지 않습니다.
     */
    @Test
    void answersNullDescriptionWhenNotWrittenYet() throws Exception {
        String body = mockMvc.perform(get(NOTE_URL, ROSE))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.nameKo").value("로즈"))
                .andReturn()
                .getResponse()
                .getContentAsString(java.nio.charset.StandardCharsets.UTF_8);

        com.fasterxml.jackson.databind.JsonNode note =
                new com.fasterxml.jackson.databind.ObjectMapper().readTree(body);

        // 키가 빠지는 것과 값이 null 인 것은 다릅니다. jsonPath 의 doesNotExist() 로는
        // 둘을 구분하지 못해 실제 모양을 직접 봅니다.
        assertThat(note.has("description")).as("키 자체는 있어야 합니다").isTrue();
        assertThat(note.get("description").isNull()).as("값은 null 이어야 합니다").isTrue();
    }

    /**
     * <b>목록에는 설명이 나가지 않습니다.</b> 활성 노트 전체를 한 번에 돌려주는 응답이라
     * 설명까지 실으면 크게 무거워지고, 화면도 목록 카드에는 이름과 이미지만 그립니다.
     */
    @Test
    void keepsDescriptionOutOfTheList() throws Exception {
        mockMvc.perform(get(NOTES_URL))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.notes[*].description").doesNotExist());

        mockMvc.perform(get(NOTES_URL).header("Accept-Language", "en"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.notes[*].description").doesNotExist())
                .andExpect(jsonPath("$.notes[*].descriptionEn").doesNotExist());
    }

    /** 없는 노트는 404 입니다. */
    @Test
    void answersNotFoundForUnknownNote() throws Exception {
        mockMvc.perform(get(NOTE_URL, 999999))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("PERFUME_NOTE_NOT_FOUND"));
    }

    /**
     * 노트별 향수가 향수 검색과 <b>같은 모양</b>으로 나갑니다.
     *
     * <p>화면이 같은 카드를 그리므로 브랜드 한국어 이름까지 실려야 합니다.
     */
    @Test
    void answersPerfumesInTheSameShapeAsSearch() throws Exception {
        mockMvc.perform(get(NOTE_PERFUMES_URL, MUSK))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.perfumes.length()").value(2))
                .andExpect(jsonPath("$.totalElements").value(2))
                .andExpect(jsonPath("$.perfumes[0].perfumeId").value(1))
                .andExpect(jsonPath("$.perfumes[0].nameKo").value("블루 드 샤넬"))
                .andExpect(jsonPath("$.perfumes[0].brandName").value("Chanel"))
                .andExpect(jsonPath("$.perfumes[0].brandNameKo").value("샤넬"));
    }

    /** 비활성 향수는 노트가 붙어 있어도 빠집니다. 검색·상세와 같은 기준입니다. */
    @Test
    void hidesInactivePerfume() throws Exception {
        mockMvc.perform(get(NOTE_PERFUMES_URL, MUSK))
                .andExpect(jsonPath("$.perfumes[*].name").value(
                        org.hamcrest.Matchers.not(
                                org.hamcrest.Matchers.hasItem("Retired Scent"))));
    }

    /** 향수가 하나도 없는 노트는 빈 목록입니다. 404 가 아닙니다. */
    @Test
    void answersEmptyForNoteWithoutPerfumes() throws Exception {
        mockMvc.perform(get(NOTE_PERFUMES_URL, JASMINE))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.perfumes.length()").value(0))
                .andExpect(jsonPath("$.totalElements").value(0));
    }

    /**
     * 없는 노트의 향수 목록은 404 입니다. 빈 목록이 아닙니다.
     *
     * <p>빈 목록으로 답하면 화면이 "향수가 없는 노트" 와 "잘못된 번호" 를 구분할 수 없습니다.
     * 바로 위 테스트와 짝입니다.
     */
    @Test
    void answersNotFoundForPerfumesOfUnknownNote() throws Exception {
        mockMvc.perform(get(NOTE_PERFUMES_URL, 999999))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("PERFUME_NOTE_NOT_FOUND"));
    }

    /** 페이지가 걸립니다. 인기 노트 하나에 향수가 수만 개 달립니다. */
    @Test
    void paginatesPerfumes() throws Exception {
        mockMvc.perform(get(NOTE_PERFUMES_URL, MUSK).param("size", "1").param("page", "0"))
                .andExpect(jsonPath("$.perfumes.length()").value(1))
                .andExpect(jsonPath("$.perfumes[0].perfumeId").value(1))
                .andExpect(jsonPath("$.totalElements").value(2));

        mockMvc.perform(get(NOTE_PERFUMES_URL, MUSK).param("size", "1").param("page", "1"))
                .andExpect(jsonPath("$.perfumes.length()").value(1))
                .andExpect(jsonPath("$.perfumes[0].perfumeId").value(2));
    }

    private void insertNote(
            long id, String name, String nameKo, String family, Integer rank, boolean active) {
        jdbcTemplate.update("""
                INSERT INTO notes (note_id, name, name_ko, accord_family, image_url,
                                   popularity_rank, is_active)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                """, id, name, nameKo, family,
                "https://cdn.test/" + name.toLowerCase() + ".jpg", rank, active);
    }

    private void insertPerfume(long id, String name, String nameKo, boolean active) {
        jdbcTemplate.update(
                "INSERT INTO perfumes (perfume_id, brand_id, name, name_ko, is_active)"
                        + " VALUES (?, 1, ?, ?, ?)",
                id, name, nameKo, active);
    }

    private void insertPerfumeNote(long perfumeId, long noteId, String noteType) {
        jdbcTemplate.update(
                "INSERT INTO perfume_notes (perfume_id, note_id, note_type) VALUES (?, ?, ?)",
                perfumeId, noteId, noteType);
    }

    private void clearData() {
        jdbcTemplate.update("DELETE FROM perfume_notes");
        jdbcTemplate.update("DELETE FROM perfumes");
        jdbcTemplate.update("DELETE FROM brands");
        jdbcTemplate.update("DELETE FROM notes");
    }
}
