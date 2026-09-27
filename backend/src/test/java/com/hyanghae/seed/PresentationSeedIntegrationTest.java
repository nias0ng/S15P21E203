package com.hyanghae.seed;

import static org.assertj.core.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import com.hyanghae.backend.BackendApplication;
import com.hyanghae.backend.perfume.repository.ReviewSummaryTarget;
import com.hyanghae.backend.review.repository.PerfumeReviewRepository;
import com.hyanghae.backend.support.IntegrationTest;
import java.nio.file.Path;
import java.sql.Connection;
import java.time.OffsetDateTime;
import java.util.*;
import javax.sql.DataSource;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.data.domain.PageRequest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.test.annotation.DirtiesContext;
import org.springframework.test.context.ContextConfiguration;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;

@IntegrationTest
@ContextConfiguration(classes = BackendApplication.class)
@AutoConfigureMockMvc
@TestPropertySource(properties = "spring.application.name=presentation-seed-integration-test")
@DirtiesContext(classMode = DirtiesContext.ClassMode.AFTER_CLASS)
class PresentationSeedIntegrationTest {
    private static final OffsetDateTime NOW = OffsetDateTime.parse("2026-09-27T09:00:00Z");
    private static final String HASH = new BCryptPasswordEncoder(4).encode("test-only-password");
    @Autowired DataSource source;
    @Autowired JdbcTemplate jdbc;
    @Autowired PerfumeReviewRepository reviews;
    @Autowired MockMvc mvc;
    private PresentationData data;

    @BeforeEach
    void catalog() throws Exception {
        data = PresentationData.load(Path.of("db/seed/presentation"));
        jdbc.execute("DROP SCHEMA IF EXISTS presentation_seed CASCADE");
        jdbc.execute("DROP SCHEMA IF EXISTS demo_seed CASCADE");
        jdbc.execute("DROP TABLE IF EXISTS unclassified_activity");
        jdbc.execute("TRUNCATE users, perfumes, brands RESTART IDENTITY CASCADE");
        // 실제 URL ID와 외부 ID를 혼동하면 통과할 수 없는 서로 다른 PK.
        for (var p : data.manifest.perfumes()) {
            jdbc.update("INSERT INTO brands(name) VALUES (?) ON CONFLICT(name) DO NOTHING", p.brand());
            jdbc.update("INSERT INTO perfumes(brand_id,name,fragrantica_id,gender) "
                    + "SELECT brand_id,?,?,'FEMALE' FROM brands WHERE name=?", p.name(), p.externalId(), p.brand());
        }
        jdbc.update("INSERT INTO perfume_images(perfume_id,image_url,image_type,display_order) SELECT perfume_id,"
                + "'https://example.test/' || fragrantica_id,'ORIGINAL',1 FROM perfumes");
        jdbc.update("INSERT INTO perfume_map_points(perfume_id,map_x,map_y) SELECT perfume_id,0.2,0.3 FROM perfumes");
        jdbc.execute("CREATE SCHEMA demo_seed");
        jdbc.execute("CREATE TABLE demo_seed.records(seed_key text)");
        jdbc.update("INSERT INTO demo_seed.records VALUES ('old-registry')");
        jdbc.update("INSERT INTO users(email,nickname,password_hash) VALUES('old@example.test','기존 사용자',?)", HASH);
        jdbc.update("INSERT INTO perfume_review_summaries(perfume_id,summary_text,source_review_count) SELECT perfume_id,'기존 요약',999 FROM perfumes");
    }

    private void run(String mode) throws Exception {
        try (Connection db = source.getConnection()) { PresentationSeed.execute(db, mode, data, HASH, NOW); }
    }
    private long count(String sql, Object... args) { return jdbc.queryForObject(sql, Long.class, args); }
    private long perfume(String key) {
        long external = data.manifest.perfumes().stream().filter(p -> p.key().equals(key)).findFirst().orElseThrow().externalId();
        return jdbc.queryForObject("SELECT perfume_id FROM perfumes WHERE fragrantica_id=?", Long.class, external);
    }
    private Map<String, List<String>> catalogSnapshot() {
        Map<String, List<String>> snapshot = new TreeMap<>();
        for (String table : PresentationSeed.CATALOG) snapshot.put(table,
                jdbc.queryForList("SELECT to_jsonb(t)::text FROM " + table + " t ORDER BY to_jsonb(t)::text", String.class));
        return snapshot;
    }

    @Test
    void planDoesNotWriteAndReplacePreservesEveryCatalogRowAndCanRepeat() throws Exception {
        var before = catalogSnapshot();
        run("plan");
        assertThat(count("SELECT count(*) FROM users")).isEqualTo(1);
        assertThat(count("SELECT count(*) FROM perfume_review_summaries")).isEqualTo(8);
        assertThat(jdbc.queryForObject("SELECT to_regclass('presentation_seed.run') IS NULL", Boolean.class)).isTrue();
        run("replace");
        assertThat(catalogSnapshot()).isEqualTo(before);
        assertThat(count("SELECT count(*) FROM users")).isEqualTo(34);
        assertThat(count("SELECT count(*) FROM perfume_reviews")).isEqualTo(85);
        assertThat(count("SELECT count(*) FROM posts")).isEqualTo(8);
        assertThat(count("SELECT count(*) FROM comments")).isEqualTo(18);
        assertThat(count("SELECT count(*) FROM collections")).isEqualTo(3);
        assertThat(count("SELECT count(*) FROM demo_seed.records")).isZero();
        assertThat(count("SELECT count(*) FROM perfume_review_summaries")).isZero();
        assertThat(new BCryptPasswordEncoder().matches("test-only-password", jdbc.queryForObject(
                "SELECT password_hash FROM users WHERE email=?", String.class, PresentationSeed.YEJIN))).isTrue();
        assertThat(count("SELECT count(*) FROM perfume_reviews r JOIN users u USING(user_id) WHERE r.created_at < u.created_at")).isZero();
        assertThat(count("SELECT count(*) FROM posts p JOIN collections c USING(collection_id) WHERE p.collection_name<>c.name")).isZero();
        assertThat(count("SELECT count(*) FROM review_likes l JOIN perfume_reviews r ON r.id=l.review_id WHERE l.user_id=r.user_id")).isZero();
        long originalMinsu = count("SELECT user_id FROM users WHERE email=?", PresentationSeed.MINSU);
        run("replace");
        run("verify");
        assertThat(count("SELECT count(*) FROM perfume_reviews")).isEqualTo(85);
        assertThat(count("SELECT user_id FROM users WHERE email=?", PresentationSeed.MINSU)).isGreaterThan(originalMinsu);
        assertThat(catalogSnapshot()).isEqualTo(before);
        mvc.perform(get("/api/v1/perfumes/{id}", perfume("cloud")))
                .andExpect(status().isOk()).andExpect(jsonPath("$.name").value("Cloud"));
    }

    @Test
    void actualSummaryRepositoryReadsTwentyDistinctReviewsAndSixEligiblePerfumes() throws Exception {
        run("replace");
        var targets = reviews.findSummaryTargets(5, 10, PageRequest.ofSize(20));
        assertThat(targets).extracting(ReviewSummaryTarget::perfumeId)
                .containsExactlyInAnyOrder(perfume("coco"), perfume("cloud"), perfume("cypress"),
                        perfume("laundry"), perfume("flowerbomb"), perfume("francois"));
        assertThat(reviews.findContentsByPerfumeId(perfume("cloud"), PageRequest.ofSize(20)))
                .hasSize(20);
        assertThat(count("SELECT count(*) FROM perfume_review_seasons")).isEqualTo(85);
        for (var r : data.reviews) {
            String email = "extra%02d@demo.hyanghae.test".formatted(r.author());
            if (Set.of("OWNED", "WISH").contains(r.experience())) {
                assertThat(jdbc.queryForObject("SELECT ownership_status FROM user_perfumes up JOIN users u USING(user_id) "
                        + "WHERE u.email=? AND perfume_id=?", String.class, email, perfume(r.perfume()))).isEqualTo(r.experience());
            }
        }
    }

    @Test
    void summaryReadinessRequiresRealStoredResultsAndAllowsOneLiveReview() throws Exception {
        run("replace");
        assertThatThrownBy(() -> run("verify-summaries")).hasMessageContaining("실제 AI 요약 생성 필요");
        // 테스트 픽스처만 사용합니다. 배포 SEED에는 요약문을 넣지 않습니다.
        jdbc.update("INSERT INTO perfume_review_summaries(perfume_id,summary_text,source_review_count,updated_at) "
                + "SELECT perfume_id,'테스트용 요약',count(*),now() FROM perfume_reviews GROUP BY perfume_id HAVING count(*)>=5");
        run("verify-summaries");
        long yejin = count("SELECT user_id FROM users WHERE email=?", PresentationSeed.YEJIN);
        jdbc.update("INSERT INTO perfume_reviews(user_id,perfume_id,title,content) VALUES(?,?,'현장 후기','클라우드를 구매하고 사용했습니다')", yejin, perfume("cloud"));
        run("verify-summaries");
        jdbc.update("UPDATE perfume_review_summaries SET source_review_count=999 WHERE perfume_id=?", perfume("cloud"));
        assertThatThrownBy(() -> run("verify-summaries")).hasMessageContaining("요약 기준 후기 수/시각: cloud");
    }

    @Test
    void resetActorsRemovesRehearsalActivityWithoutRemovingBackgroundOrOtherUsers() throws Exception {
        run("replace");
        long yejin = count("SELECT user_id FROM users WHERE email=?", PresentationSeed.YEJIN);
        long cloud = perfume("cloud");
        jdbc.update("INSERT INTO user_perfumes(user_id,perfume_id,ownership_status) VALUES(?,?,'OWNED')", yejin, cloud);
        jdbc.update("INSERT INTO perfume_reviews(user_id,perfume_id,title,content) VALUES(?,?,'현장 후기','클라우드를 직접 사용했습니다')", yejin, cloud);
        jdbc.update("INSERT INTO collections(user_id,name) VALUES(?,'달달한 향 모음')", yejin);
        jdbc.update("INSERT INTO posts(user_id,title,content) VALUES(?,'현장 공유','방금 만든 컬렉션입니다')", yejin);
        jdbc.update("INSERT INTO perfume_review_summaries(perfume_id,summary_text,source_review_count) VALUES(?,'현장 후기 반영 요약',21)", cloud);
        jdbc.update("INSERT INTO users(email,nickname,password_hash) VALUES('keep@example.test','보존 사용자',?)", HASH);
        run("reset-actors");
        run("verify");
        assertThat(count("SELECT count(*) FROM perfume_reviews WHERE perfume_id=?", cloud)).isEqualTo(20);
        assertThat(count("SELECT count(*) FROM perfume_review_summaries WHERE perfume_id=?", cloud)).isZero();
        assertThat(count("SELECT count(*) FROM posts")).isEqualTo(8);
        assertThat(count("SELECT count(*) FROM collections")).isEqualTo(3);
        assertThat(count("SELECT count(*) FROM users WHERE email='keep@example.test'")).isEqualTo(1);
        assertThat(count("SELECT user_id FROM users WHERE email=?", PresentationSeed.YEJIN)).isGreaterThan(yejin);
        assertThat(count("SELECT count(*) FROM user_perfumes up JOIN users u USING(user_id) WHERE u.email=?", PresentationSeed.YEJIN)).isEqualTo(3);
    }

    @Test
    void missingIdentityAndUnknownTablesStopBeforeDeletingAnything() throws Exception {
        jdbc.update("UPDATE perfumes SET name='다른 제품' WHERE fragrantica_id=50384");
        assertThatThrownBy(() -> run("replace")).hasMessageContaining("카탈로그 향수 식별: cloud");
        assertThat(count("SELECT count(*) FROM users")).isEqualTo(1);
        jdbc.update("UPDATE perfumes SET name='Cloud' WHERE fragrantica_id=50384");
        jdbc.execute("CREATE TABLE unclassified_activity(id bigint)");
        assertThatThrownBy(() -> run("replace")).hasMessageContaining("unclassified_activity");
        assertThat(count("SELECT count(*) FROM users")).isEqualTo(1);
    }

    @Test
    void insertionFailureRollsBackCleanupAndLegacyRegistry() throws Exception {
        jdbc.execute("ALTER TABLE users ADD CONSTRAINT reject_seed CHECK(email NOT LIKE '%@demo.hyanghae.test')");
        try {
            assertThatThrownBy(() -> run("replace")).isInstanceOf(java.sql.SQLException.class);
            assertThat(count("SELECT count(*) FROM users WHERE email='old@example.test'")).isEqualTo(1);
            assertThat(count("SELECT count(*) FROM demo_seed.records")).isEqualTo(1);
            assertThat(count("SELECT count(*) FROM perfume_review_summaries")).isEqualTo(8);
        } finally {
            jdbc.execute("ALTER TABLE users DROP CONSTRAINT reject_seed");
        }
    }
}
