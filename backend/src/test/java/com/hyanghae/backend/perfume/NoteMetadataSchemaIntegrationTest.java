package com.hyanghae.backend.perfume;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.hyanghae.backend.support.IntegrationTest;
import java.util.Map;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.jdbc.core.JdbcTemplate;

/** 노트 표시 메타데이터를 기존 노트와 함께 안전하게 저장할 수 있는지 확인합니다. */
@IntegrationTest
class NoteMetadataSchemaIntegrationTest {

    private static final long NOTE_ID = 9901L;
    private static final String NOTE_NAME = "Schema Probe Note";

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @AfterEach
    void cleanUp() {
        jdbcTemplate.update("DELETE FROM notes WHERE note_id = ?", NOTE_ID);
    }

    @Test
    void storesLocalizedNameFamilyImageAndPopularityRank() {
        jdbcTemplate.update(
                "INSERT INTO notes (note_id, name, name_ko, accord_family, image_url,"
                        + " popularity_rank, is_active) VALUES (?, ?, ?, ?, ?, ?, true)",
                NOTE_ID,
                NOTE_NAME,
                "테스트 노트",
                "WOODY",
                "https://cdn.example.com/notes/schema-probe-note.jpg",
                247);

        Map<String, Object> stored = jdbcTemplate.queryForMap(
                "SELECT name_ko, accord_family, image_url, popularity_rank"
                        + " FROM notes WHERE note_id = ?",
                NOTE_ID);

        assertThat(stored)
                .containsEntry("name_ko", "테스트 노트")
                .containsEntry("accord_family", "WOODY")
                .containsEntry("image_url", "https://cdn.example.com/notes/schema-probe-note.jpg")
                .containsEntry("popularity_rank", 247);
    }

    @Test
    void keepsNewMetadataNullableForExistingAndUnrankedNotes() {
        jdbcTemplate.update(
                "INSERT INTO notes (note_id, name, is_active) VALUES (?, ?, true)",
                NOTE_ID,
                NOTE_NAME);

        Map<String, Object> stored = jdbcTemplate.queryForMap(
                "SELECT name_ko, accord_family, image_url, popularity_rank"
                        + " FROM notes WHERE note_id = ?",
                NOTE_ID);

        assertThat(stored.values()).containsOnlyNulls();
    }

    @Test
    void rejectsNonPositivePopularityRank() {
        assertThatThrownBy(() -> jdbcTemplate.update(
                "INSERT INTO notes (note_id, name, popularity_rank, is_active)"
                        + " VALUES (?, ?, 0, true)",
                NOTE_ID,
                NOTE_NAME))
                .isInstanceOf(DataIntegrityViolationException.class);
    }
}
