package com.hyanghae.backend.perfume;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.hyanghae.backend.support.IntegrationTest;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.jdbc.core.JdbcTemplate;

/** 일반 이미지와 종이 질감 이미지를 스키마에서 안전하게 구분하는지 확인합니다. */
@IntegrationTest
class PerfumeImageMetadataSchemaIntegrationTest {

    private static final long BRAND_ID = 9801L;
    private static final long PERFUME_ID = 9801L;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @BeforeEach
    void insertPerfume() {
        cleanUp();
        jdbcTemplate.update("INSERT INTO brands (brand_id, name) VALUES (?, ?)", BRAND_ID, "Image Probe");
        jdbcTemplate.update(
                "INSERT INTO perfumes (perfume_id, brand_id, name, fragrantica_id, is_active)"
                        + " VALUES (?, ?, ?, ?, true)",
                PERFUME_ID, BRAND_ID, "Image Probe Perfume", 9801L);
    }

    @AfterEach
    void cleanUp() {
        jdbcTemplate.update("DELETE FROM perfume_images WHERE perfume_id = ?", PERFUME_ID);
        jdbcTemplate.update("DELETE FROM perfumes WHERE perfume_id = ?", PERFUME_ID);
        jdbcTemplate.update("DELETE FROM brands WHERE brand_id = ?", BRAND_ID);
    }

    @Test
    void treatsExistingStyleInsertAsOriginalImage() {
        jdbcTemplate.update(
                "INSERT INTO perfume_images (perfume_id, image_url, display_order) VALUES (?, ?, 1)",
                PERFUME_ID, "https://cdn.example.com/perfumes/9801/original.png");

        String imageType = jdbcTemplate.queryForObject(
                "SELECT image_type FROM perfume_images WHERE perfume_id = ?",
                String.class, PERFUME_ID);

        assertThat(imageType).isEqualTo("ORIGINAL");
    }

    @Test
    void storesPaperTextureSeparately() {
        jdbcTemplate.update(
                "INSERT INTO perfume_images (perfume_id, image_url, image_type, display_order)"
                        + " VALUES (?, ?, 'PAPER_TEXTURE', 2)",
                PERFUME_ID, "https://cdn.example.com/perfumes/9801/paper-texture.png");

        String imageType = jdbcTemplate.queryForObject(
                "SELECT image_type FROM perfume_images WHERE perfume_id = ?",
                String.class, PERFUME_ID);

        assertThat(imageType).isEqualTo("PAPER_TEXTURE");
    }

    @Test
    void rejectsUnknownImageType() {
        assertThatThrownBy(() -> jdbcTemplate.update(
                "INSERT INTO perfume_images (perfume_id, image_url, image_type, display_order)"
                        + " VALUES (?, ?, 'UNKNOWN', 1)",
                PERFUME_ID, "https://cdn.example.com/perfumes/9801/unknown.png"))
                .isInstanceOf(DataIntegrityViolationException.class);
    }
}
