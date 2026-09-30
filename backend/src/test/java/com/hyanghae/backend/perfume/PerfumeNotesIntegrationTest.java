package com.hyanghae.backend.perfume;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.hyanghae.backend.perfume.exception.PerfumeErrorCode;
import com.hyanghae.backend.support.IntegrationTest;
import java.math.BigDecimal;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;

/**
 * 향수 향조 조회 API 를 실제 PostgreSQL 위에서 검증합니다.
 *
 * <p>노트와 어코드는 조인 테이블에 추가 컬럼({@code note_type}, {@code rank}, {@code weight})이
 * 있어 복합키 엔티티로 매핑했습니다. 그 매핑이 실제로 동작하는지는 통합 테스트로만 확인됩니다.
 */
@IntegrationTest
@AutoConfigureMockMvc
class PerfumeNotesIntegrationTest {

    private static final String NOTES_URL = "/api/v1/perfumes/{perfumeId}/notes";

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @BeforeEach
    void insertFixtures() {
        clearData();

        insertBrand(1, "Chanel");
        insertPerfume(1, 1, "Bleu de Chanel", true);
        insertPerfume(2, 1, "No Composition Scent", true);
        insertPerfume(3, 1, "Retired Scent", false);

        insertNote(1, "Bergamot");
        insertNote(2, "Amber");
        insertNote(3, "Cedar");

        insertAccord(1, "Woody");
        insertAccord(2, "Citrus");
        insertAccord(3, "Spicy");

        // 이름 오름차순(Amber, Bergamot, Cedar)과 다른 순서로 넣습니다.
        // HEART 는 명세에 없는 값입니다. 백엔드가 해석하지 않고 그대로 전달하는지 봅니다.
        insertPerfumeNote(1, 3, "HEART");
        insertPerfumeNote(1, 1, "TOP");
        insertPerfumeNote(1, 2, "BASE");

        // rank 오름차순(Citrus 1, Woody 2, Spicy NULL)과 다른 순서로 넣습니다.
        insertPerfumeAccord(1, 3, null, null);
        insertPerfumeAccord(1, 1, 2, "0.300000");
        insertPerfumeAccord(1, 2, 1, "0.550000");
    }

    @AfterEach
    void cleanUp() {
        clearData();
    }

    /** 노트는 이름 오름차순입니다. 삽입 순서가 아닙니다. */
    @Test
    void returnsNotesOrderedByName() throws Exception {
        mockMvc.perform(get(NOTES_URL, 1))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.notes.length()").value(3))
                .andExpect(jsonPath("$.notes[0].noteId").value(2))
                .andExpect(jsonPath("$.notes[0].name").value("Amber"))
                .andExpect(jsonPath("$.notes[0].noteType").value("BASE"))
                .andExpect(jsonPath("$.notes[1].name").value("Bergamot"))
                .andExpect(jsonPath("$.notes[1].noteType").value("TOP"))
                .andExpect(jsonPath("$.notes[2].name").value("Cedar"));
    }

    /**
     * 노트 이름은 영문과 한국어 둘 다 옵니다. 화면이 언어에 맞춰 고릅니다.
     *
     * <p>요청 언어와 관계없이 같은 짝이 옵니다. 한국어 이름이 없는 노트는 {@code nameKo} 가 비고,
     * 영문 이름은 그대로입니다.
     */
    @ParameterizedTest
    @ValueSource(strings = {"ko", "en"})
    void returnsBothNoteNamesRegardlessOfLanguage(String language) throws Exception {
        jdbcTemplate.update("UPDATE notes SET name_ko = '앰버' WHERE note_id = 2");

        mockMvc.perform(get(NOTES_URL, 1).header("Accept-Language", language))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.notes[0].name").value("Amber"))
                .andExpect(jsonPath("$.notes[0].nameKo").value("앰버"))
                .andExpect(jsonPath("$.notes[1].name").value("Bergamot"))
                .andExpect(jsonPath("$.notes[1].nameKo").doesNotExist());
    }

    /** 명세에 없는 noteType 도 해석하지 않고 그대로 전달합니다. 세 단계로 나눠 담으면 버려집니다. */
    @Test
    void passesThroughUnknownNoteType() throws Exception {
        mockMvc.perform(get(NOTES_URL, 1))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.notes[2].noteType").value("HEART"));
    }

    /** 어코드는 rank 오름차순이고 rank 가 없는 것은 뒤로 밀립니다. */
    @Test
    void returnsAccordsOrderedByRank() throws Exception {
        mockMvc.perform(get(NOTES_URL, 1))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.accords.length()").value(3))
                .andExpect(jsonPath("$.accords[0].accordId").value(2))
                .andExpect(jsonPath("$.accords[0].name").value("Citrus"))
                .andExpect(jsonPath("$.accords[0].rank").value(1))
                .andExpect(jsonPath("$.accords[0].weight").value(0.55))
                .andExpect(jsonPath("$.accords[1].name").value("Woody"))
                .andExpect(jsonPath("$.accords[1].rank").value(2))
                .andExpect(jsonPath("$.accords[2].name").value("Spicy"))
                .andExpect(jsonPath("$.accords[2].rank").doesNotExist());
    }

    /** 향조 정보가 없는 향수는 빈 배열입니다. 404 로 하면 향수가 없는 경우와 구분되지 않습니다. */
    @Test
    void returnsEmptyListsWhenPerfumeHasNoComposition() throws Exception {
        mockMvc.perform(get(NOTES_URL, 2))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.notes").isEmpty())
                .andExpect(jsonPath("$.accords").isEmpty());
    }

    @Test
    void returnsNotFoundWhenPerfumeDoesNotExist() throws Exception {
        mockMvc.perform(get(NOTES_URL, 999))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value(PerfumeErrorCode.PERFUME_NOT_FOUND.code()));
    }

    /** 비활성 향수는 검색·상세와 같은 기준으로 조회되지 않습니다. */
    @Test
    void returnsNotFoundForInactivePerfume() throws Exception {
        mockMvc.perform(get(NOTES_URL, 3))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value(PerfumeErrorCode.PERFUME_NOT_FOUND.code()));
    }

    private void insertBrand(long id, String name) {
        jdbcTemplate.update(
                "INSERT INTO brands (brand_id, name, is_active) VALUES (?, ?, true)", id, name);
    }

    private void insertPerfume(long id, long brandId, String name, boolean active) {
        jdbcTemplate.update(
                "INSERT INTO perfumes (perfume_id, brand_id, name, is_active) VALUES (?, ?, ?, ?)",
                id, brandId, name, active);
    }

    private void insertNote(long id, String name) {
        jdbcTemplate.update(
                "INSERT INTO notes (note_id, name, is_active) VALUES (?, ?, true)", id, name);
    }

    private void insertAccord(long id, String name) {
        jdbcTemplate.update(
                "INSERT INTO accords (accord_id, name, is_active) VALUES (?, ?, true)", id, name);
    }

    private void insertPerfumeNote(long perfumeId, long noteId, String noteType) {
        jdbcTemplate.update(
                "INSERT INTO perfume_notes (perfume_id, note_id, note_type) VALUES (?, ?, ?)",
                perfumeId, noteId, noteType);
    }

    private void insertPerfumeAccord(long perfumeId, long accordId, Integer rank, String weight) {
        jdbcTemplate.update(
                "INSERT INTO perfume_accords (perfume_id, accord_id, rank, weight) VALUES (?, ?, ?, ?)",
                perfumeId, accordId, rank, weight == null ? null : new BigDecimal(weight));
    }

    private void clearData() {
        jdbcTemplate.update("DELETE FROM perfume_notes");
        jdbcTemplate.update("DELETE FROM perfume_accords");
        jdbcTemplate.update("DELETE FROM notes");
        jdbcTemplate.update("DELETE FROM accords");
        jdbcTemplate.update("DELETE FROM perfumes");
        jdbcTemplate.update("DELETE FROM brands");
    }
}
