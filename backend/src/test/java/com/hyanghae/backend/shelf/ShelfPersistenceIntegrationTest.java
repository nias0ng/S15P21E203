package com.hyanghae.backend.shelf;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.hyanghae.backend.shelf.entity.Memo;
import com.hyanghae.backend.shelf.entity.OwnershipStatus;
import com.hyanghae.backend.shelf.entity.UserPerfume;
import com.hyanghae.backend.shelf.repository.MemoRepository;
import com.hyanghae.backend.shelf.repository.UserPerfumeRepository;
import com.hyanghae.backend.support.IntegrationTest;
import jakarta.persistence.EntityManagerFactory;
import java.math.BigDecimal;
import java.time.LocalDate;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.dao.DataIntegrityViolationException;
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
    private MemoRepository memoRepository;

    @Autowired
    private EntityManagerFactory entityManagerFactory;

    @Test
    void mapsShelfItemAndMemoFromCurrentSchema() {
        ShelfFixture fixture = insertShelfItem();
        Long memoId = insertMemo(fixture.shelfItemId(), "차분한 우디 향");

        UserPerfume shelfItem = userPerfumeRepository.findById(fixture.shelfItemId()).orElseThrow();
        Memo memo = memoRepository.findById(memoId).orElseThrow();

        assertThat(shelfItem.getUserId()).isEqualTo(fixture.userId());
        assertThat(entityManagerFactory.getPersistenceUnitUtil().getIdentifier(shelfItem.getPerfume()))
                .isEqualTo(fixture.perfumeId());
        assertThat(shelfItem.getOwnershipStatus()).isEqualTo(OwnershipStatus.TRIED);
        assertThat(shelfItem.getFitRating()).isEqualByComparingTo(new BigDecimal("4.5"));
        assertThat(shelfItem.getRepresentative()).isFalse();
        assertThat(shelfItem.getCreatedAt()).isNotNull();
        assertThat(shelfItem.getUpdatedAt()).isNotNull();

        assertThat(memo.getUserPerfume().getId()).isEqualTo(fixture.shelfItemId());
        assertThat(memo.getContent()).isEqualTo("차분한 우디 향");
        assertThat(memo.getTestedAt()).isEqualTo(LocalDate.of(2026, 9, 9));
        assertThat(memo.getCreatedAt()).isNotNull();
        assertThat(memo.getUpdatedAt()).isNotNull();
    }

    @Test
    void rejectsMoreThanOneMemoForSameShelfItem() {
        ShelfFixture fixture = insertShelfItem();
        insertMemo(fixture.shelfItemId(), "첫 번째 기록");

        assertThatThrownBy(() -> insertMemo(fixture.shelfItemId(), "두 번째 기록"))
                .isInstanceOf(DataIntegrityViolationException.class);
    }

    @Test
    void rejectsSamePerfumeTwiceForSameUser() {
        ShelfFixture fixture = insertShelfItem();

        assertThatThrownBy(() -> insertShelfItem(fixture.userId(), fixture.perfumeId(), false))
                .isInstanceOf(DataIntegrityViolationException.class);
    }

    @Test
    void rejectsMoreThanOneRepresentativePerfumeForSameUser() {
        Long userId = insertUser();
        insertShelfItem(userId, insertPerfume("first-perfume"), true);

        assertThatThrownBy(() -> insertShelfItem(userId, insertPerfume("second-perfume"), true))
                .isInstanceOf(DataIntegrityViolationException.class);
    }

    @Test
    void deletingShelfItemCascadesToMemo() {
        ShelfFixture fixture = insertShelfItem();
        Long memoId = insertMemo(fixture.shelfItemId(), "삭제될 기록");

        jdbcTemplate.update(
                "DELETE FROM user_perfumes WHERE user_perfumes_id = ?",
                fixture.shelfItemId()
        );

        assertThat(memoRepository.findById(memoId)).isEmpty();
    }

    private ShelfFixture insertShelfItem() {
        Long userId = insertUser();
        Long perfumeId = insertPerfume("test-perfume");
        Long shelfItemId = insertShelfItem(userId, perfumeId, false);

        return new ShelfFixture(userId, perfumeId, shelfItemId);
    }

    private Long insertUser() {
        return jdbcTemplate.queryForObject("""
                INSERT INTO users (email, password_hash, nickname)
                VALUES ('shelf-test@example.com', 'not-a-real-password-hash', 'shelf-test')
                RETURNING user_id
                """, Long.class);
    }

    private Long insertPerfume(String name) {
        return jdbcTemplate.queryForObject("""
                INSERT INTO perfumes (name)
                VALUES (?)
                RETURNING perfume_id
                """, Long.class, name);
    }

    private Long insertShelfItem(Long userId, Long perfumeId, boolean representative) {
        return jdbcTemplate.queryForObject("""
                INSERT INTO user_perfumes (
                    user_id, perfume_id, ownership_status, fit_rating, is_representative, created_at, updated_at
                )
                VALUES (?, ?, 'TRIED', 4.5, ?, NOW(), NOW())
                RETURNING user_perfumes_id
                """, Long.class, userId, perfumeId, representative);
    }

    private Long insertMemo(Long shelfItemId, String content) {
        return jdbcTemplate.queryForObject("""
                INSERT INTO personal_records (user_perfume_id, content, tested_at, created_at, updated_at)
                VALUES (?, ?, DATE '2026-09-09', NOW(), NOW())
                RETURNING id
                """, Long.class, shelfItemId, content);
    }

    private record ShelfFixture(Long userId, Long perfumeId, Long shelfItemId) {
    }
}
