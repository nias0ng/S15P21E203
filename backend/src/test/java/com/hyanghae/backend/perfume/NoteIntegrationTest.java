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
 * 노트 목록·상세와 노트별 향수를 검증합니다(와이어프레임 A35 · A36).
 *
 * <p>고정 데이터는 순서와 거르기를 함께 볼 수 있게 짰습니다.
 *
 * <ul>
 *   <li>노트 1 {@code Musk} / MUSK / 순위 1 — 향수 2개
 *   <li>노트 2 {@code Rose} / FLORAL / 순위 8 — 향수 1개
 *   <li>노트 3 {@code Jasmine} / FLORAL / 순위 6 — 향수 없음
 *   <li>노트 4 {@code Amber} / AMBER / <b>순위 없음</b> — 순위가 빈 노트가 뒤로 밀리는지
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

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @BeforeEach
    void insertFixtures() {
        clearData();

        insertNote(MUSK, "Musk", "머스크", "MUSK", 1, true);
        insertNote(ROSE, "Rose", "로즈", "FLORAL", 8, true);
        insertNote(JASMINE, "Jasmine", "자스민", "FLORAL", 6, true);
        insertNote(AMBER, "Amber", "앰버", "AMBER", null, true);
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

    /** 상세는 목록 한 줄과 같은 모양입니다. */
    @Test
    void answersNoteDetail() throws Exception {
        mockMvc.perform(get(NOTE_URL, MUSK))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.noteId").value((int) MUSK))
                .andExpect(jsonPath("$.nameKo").value("머스크"))
                .andExpect(jsonPath("$.accordFamily").value("MUSK"));
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
