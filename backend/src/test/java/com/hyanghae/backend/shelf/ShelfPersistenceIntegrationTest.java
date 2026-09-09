package com.hyanghae.backend.shelf;

import static org.assertj.core.api.Assertions.assertThat;

import com.hyanghae.backend.shelf.entity.OwnershipStatus;
import com.hyanghae.backend.shelf.entity.PersonalRecord;
import com.hyanghae.backend.shelf.entity.UserPerfume;
import com.hyanghae.backend.shelf.repository.PersonalRecordRepository;
import com.hyanghae.backend.shelf.repository.UserPerfumeRepository;
import com.hyanghae.backend.support.IntegrationTest;
import jakarta.persistence.EntityManagerFactory;
import java.math.BigDecimal;
import java.time.LocalDate;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.annotation.Transactional;

@IntegrationTest
@Transactional
class ShelfPersistenceIntegrationTest {

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Autowired
    private UserPerfumeRepository userPerfumeRepository;

    @Autowired
    private PersonalRecordRepository personalRecordRepository;

    @Autowired
    private EntityManagerFactory entityManagerFactory;

    @Test
    void mapsShelfItemAndPersonalRecordFromCurrentSchema() {
        Long userId = jdbcTemplate.queryForObject("""
                INSERT INTO users (email, password_hash, nickname)
                VALUES ('shelf-test@example.com', 'not-a-real-password-hash', 'shelf-test')
                RETURNING user_id
                """, Long.class);
        Long brandId = jdbcTemplate.queryForObject("""
                INSERT INTO brands (name)
                VALUES ('test-brand')
                RETURNING brand_id
                """, Long.class);
        Long perfumeId = jdbcTemplate.queryForObject("""
                INSERT INTO perfumes (brand_id, name)
                VALUES (?, 'test-perfume')
                RETURNING perfume_id
                """, Long.class, brandId);
        Long shelfItemId = jdbcTemplate.queryForObject("""
                INSERT INTO user_perfumes (
                    user_id, perfume_id, ownership_status, fit_rating, is_representative, created_at, updated_at
                )
                VALUES (?, ?, 'TRIED', 4.5, false, NOW(), NOW())
                RETURNING user_perfumes_id
                """, Long.class, userId, perfumeId);
        Long recordId = jdbcTemplate.queryForObject("""
                INSERT INTO personal_records (user_perfume_id, content, tested_at, created_at, updated_at)
                VALUES (?, '차분한 우디 향', DATE '2026-09-09', NOW(), NOW())
                RETURNING id
                """, Long.class, shelfItemId);

        UserPerfume shelfItem = userPerfumeRepository.findById(shelfItemId).orElseThrow();
        PersonalRecord record = personalRecordRepository.findById(recordId).orElseThrow();

        assertThat(shelfItem.getUserId()).isEqualTo(userId);
        assertThat(entityManagerFactory.getPersistenceUnitUtil().getIdentifier(shelfItem.getPerfume()))
                .isEqualTo(perfumeId);
        assertThat(shelfItem.getOwnershipStatus()).isEqualTo(OwnershipStatus.TRIED);
        assertThat(shelfItem.getFitRating()).isEqualByComparingTo(new BigDecimal("4.5"));
        assertThat(shelfItem.getRepresentative()).isFalse();
        assertThat(shelfItem.getCreatedAt()).isNotNull();
        assertThat(shelfItem.getUpdatedAt()).isNotNull();
        assertThat(shelfItem.getDeletedAt()).isNull();

        assertThat(record.getUserPerfume().getId()).isEqualTo(shelfItemId);
        assertThat(record.getContent()).isEqualTo("차분한 우디 향");
        assertThat(record.getTestedAt()).isEqualTo(LocalDate.of(2026, 9, 9));
        assertThat(record.getCreatedAt()).isNotNull();
        assertThat(record.getUpdatedAt()).isNotNull();
    }
}
