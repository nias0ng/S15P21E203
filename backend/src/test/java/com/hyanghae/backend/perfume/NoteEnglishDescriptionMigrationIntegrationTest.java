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

/**
 * V29 가 이미 실린 노트에 영어 설명을 채우는지 봅니다.
 *
 * <p>테스트 DB 는 비어 있는 채로 마이그레이션을 마치므로 V29 의 UPDATE 가 고칠 행이 없었습니다.
 * 운영처럼 노트가 먼저 실린 상태를 만들고 같은 스크립트를 직접 다시 돌립니다. 컬럼 추가가
 * {@code IF NOT EXISTS} 라 다시 돌려도 실패하지 않습니다.
 */
@IntegrationTest
class NoteEnglishDescriptionMigrationIntegrationTest {

    private static final String SCRIPT = "db/migration/V29__add_note_english_description.sql";

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @BeforeEach
    void clearNotes() {
        jdbcTemplate.update("DELETE FROM perfume_notes");
        jdbcTemplate.update("DELETE FROM notes");
    }

    @AfterEach
    void cleanUp() {
        clearNotes();
    }

    /** 대표 노트들이 영어 설명을 얻고, 한국어 설명은 그대로입니다. */
    @Test
    void fillsEnglishDescriptionOfExistingNotes() throws Exception {
        insertNote(1, "Musk", "포근한 살결과 깨끗한 비누를 연상시키는 부드러운 향입니다.");
        insertNote(2, "Bergamot", "상쾌한 감귤 향입니다.");
        insertNote(3, "Pink Grapefruit", "자몽 특유의 쌉싸름함이 있는 시트러스 향입니다.");
        insertNote(4, "Mahogany", "짙고 단단한 목재 향입니다.");

        runMigration();

        assertThat(descriptionEn(1)).startsWith("A soft scent that evokes warm skin and clean soap.");
        assertThat(descriptionEn(2)).contains("citrus");
        // 작은따옴표가 든 문장입니다. SQL 에서 '' 로 적은 것이 한 개로 들어가야 합니다.
        assertThat(descriptionEn(3)).contains("grapefruit's");
        assertThat(descriptionEn(4)).contains("woody");
        assertThat(description(1)).isEqualTo("포근한 살결과 깨끗한 비누를 연상시키는 부드러운 향입니다.");
    }

    /** 목록에 없는 노트는 건드리지 않습니다. 영어 설명이 비어 한국어로 되돌아갑니다. */
    @Test
    void leavesUnknownNotesAlone() throws Exception {
        insertNote(1, "Unlisted Probe Note", "목록에 없는 노트입니다.");

        runMigration();

        assertThat(descriptionEn(1)).isNull();
    }

    /** 배포마다 다시 돌지는 않지만, 수동으로 다시 돌려도 결과가 같아야 합니다. */
    @Test
    void runningTwiceGivesTheSameResult() throws Exception {
        insertNote(1, "Musk", "포근한 향입니다.");

        runMigration();
        String first = descriptionEn(1);
        runMigration();

        assertThat(descriptionEn(1)).isNotBlank().isEqualTo(first);
    }

    /** 원본 246개 노트 전부에 영어 설명 문장이 있습니다. 하나라도 빠지면 영어 화면이 한국어로 섞입니다. */
    @Test
    void coversEveryNoteOfTheSeed() throws Exception {
        String sql = new ClassPathResource(SCRIPT).getContentAsString(StandardCharsets.UTF_8);

        long updates = sql.lines().filter(line -> line.startsWith("UPDATE notes SET description_en")).count();

        assertThat(updates).isEqualTo(246);
    }

    private void runMigration() throws Exception {
        String sql = new ClassPathResource(SCRIPT).getContentAsString(StandardCharsets.UTF_8);
        jdbcTemplate.execute(sql);
    }

    private void insertNote(long noteId, String name, String description) {
        jdbcTemplate.update(
                "INSERT INTO notes (note_id, name, description, is_active) VALUES (?, ?, ?, true)",
                noteId, name, description);
    }

    private String descriptionEn(long noteId) {
        return jdbcTemplate.queryForObject(
                "SELECT description_en FROM notes WHERE note_id = ?", String.class, noteId);
    }

    private String description(long noteId) {
        return jdbcTemplate.queryForObject(
                "SELECT description FROM notes WHERE note_id = ?", String.class, noteId);
    }
}
