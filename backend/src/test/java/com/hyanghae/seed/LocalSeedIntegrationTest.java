package com.hyanghae.seed;

import static org.assertj.core.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import com.hyanghae.backend.BackendApplication;
import com.hyanghae.backend.perfume.dto.request.RankingType;
import com.hyanghae.backend.perfume.repository.PerfumeRankingRepository;
import com.hyanghae.backend.support.IntegrationTest;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import javax.sql.DataSource;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.test.context.ContextConfiguration;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.annotation.DirtiesContext;
import org.springframework.test.web.servlet.MockMvc;

@IntegrationTest
@ContextConfiguration(classes = BackendApplication.class)
@AutoConfigureMockMvc
// 기존 API 테스트 중 기준 데이터도 지우는 테스트가 있어, 별도 컨텍스트/컨테이너를 사용합니다.
@TestPropertySource(properties = "spring.application.name=local-seed-integration-test")
@DirtiesContext(classMode = DirtiesContext.ClassMode.AFTER_CLASS)
class LocalSeedIntegrationTest {
    private static final Path DATA = Path.of("db/seed");
    private static final String HASH = new BCryptPasswordEncoder(4).encode("test-only-password");
    @Autowired DataSource dataSource;
    @Autowired JdbcTemplate jdbc;
    @Autowired PerfumeRankingRepository ranking;
    @Autowired MockMvc mvc;
    private String url;
    private String user;
    private String password;

    @Autowired org.testcontainers.containers.PostgreSQLContainer<?> postgres;

    @BeforeEach
    void catalog() throws Exception {
        url = postgres.getJdbcUrl();
        user = postgres.getUsername();
        password = postgres.getPassword();
        jdbc.execute("DROP SCHEMA IF EXISTS local_seed CASCADE");
        jdbc.execute("DROP SCHEMA IF EXISTS demo_seed CASCADE");
        jdbc.execute("TRUNCATE users, perfumes, brands RESTART IDENTITY CASCADE");
        jdbc.update("INSERT INTO brands(name, name_ko) VALUES ('Seed Brand', '테스트 브랜드')");
        Map<Long, Integer> manifest = new HashMap<>();
        for (String line : Files.readAllLines(DATA.resolve("perfume_images.csv")).subList(1, 313)) {
            String[] cells = line.split(",", 3);
            manifest.put(Long.parseLong(cells[1].replace("\"", "")), Integer.parseInt(cells[0].replace("\"", "")));
        }
        // 실제 manifest를 쓰되 DB PK는 외부 번호와 다르게 만듭니다.
        for (int rank = 1; rank <= 200; rank++) {
            int selection = rank;
            long external = manifest.entrySet().stream().filter(e -> e.getValue() == selection)
                    .mapToLong(Map.Entry::getKey).findFirst().orElse(900000L + rank);
            long id = jdbc.queryForObject("INSERT INTO perfumes(brand_id,name,name_ko,gender,fragrantica_id,korea_selection_rank) "
                    + "VALUES (1,?,?,?,?,?) RETURNING perfume_id", Long.class, "Perfume " + rank,
                    "향수 " + rank, rank % 2 == 0 ? "MALE" : "FEMALE", external, rank);
            if (manifest.containsKey(external)) {
                for (String type : List.of("ORIGINAL", "PAPER_TEXTURE")) jdbc.update(
                        "INSERT INTO perfume_images(perfume_id,image_url,image_type,display_order) VALUES (?,?,?,?)",
                        id, "https://example.test/perfume/" + external + "/" + type, type, type.equals("ORIGINAL") ? 1 : 2);
            }
        }
    }

    private void seed(boolean reset) throws Exception {
        LocalSeed.run(url, user, password, DATA, reset, HASH);
    }

    private long count(String sql, Object... args) {
        return jdbc.queryForObject(sql, Long.class, args);
    }

    private Map<String, Long> counts() {
        Map<String, Long> result = new HashMap<>();
        for (String table : List.of("users", "perfumes", "perfume_images", "user_perfumes", "memos",
                "collections", "collection_perfumes", "perfume_reviews", "perfume_review_seasons",
                "review_likes", "user_perfume_views", "posts", "post_perfumes", "comments", "post_likes", "local_seed.records")) {
            result.put(table, count("SELECT count(*) FROM " + table));
        }
        return result;
    }

    @Test
    void fillIsRepeatableAndAllImagePerfumesAppearInRealRankingApi() throws Exception {
        seed(false);
        Map<String, Long> first = counts();
        seed(false);
        assertThat(counts()).isEqualTo(first);
        assertThat(first.get("users")).isEqualTo(55);
        assertThat(first.get("perfumes")).isEqualTo(200);
        assertThat(first.get("perfume_images")).isEqualTo(312);
        assertThat(first.get("collections")).isEqualTo(30);
        assertThat(first.get("posts")).isEqualTo(90);
        assertThat(count("SELECT count(*) FROM user_perfumes up JOIN users u ON u.user_id=up.user_id "
                + "WHERE u.email='demo43@demo.hyanghae.test'")).isZero();
        String hash = jdbc.queryForObject("SELECT password_hash FROM users WHERE email='demo41@demo.hyanghae.test'", String.class);
        assertThat(new BCryptPasswordEncoder().matches("test-only-password", hash)).isTrue();
        for (RankingType type : List.of(RankingType.OWNED, RankingType.WISH, RankingType.VIEWED)) {
            assertThat(ranking.count(type, null, null, null, null)).isEqualTo(156);
            var expected = jdbc.queryForList("SELECT DISTINCT perfume_id FROM perfume_images ORDER BY perfume_id", Long.class);
            var actual = new java.util.ArrayList<Long>();
            for (int page = 0; page < 8; page++) {
                actual.addAll(ranking.findPage(type, null, null, null, null, page * 20, 20).stream()
                        .map(r -> r.perfumeId()).toList());
            }
            assertThat(actual).doesNotHaveDuplicates().containsExactlyInAnyOrderElementsOf(expected);
            mvc.perform(get("/api/v1/perfumes").param("ranking", type.name()).param("page", "7"))
                    .andExpect(status().isOk()).andExpect(jsonPath("$.perfumes.length()").value(16));
            assertThat(ranking.count(type, null, "Seed Brand", null, "MALE"))
                    .isEqualTo(count("SELECT count(DISTINCT p.perfume_id) FROM perfumes p JOIN perfume_images i USING(perfume_id) WHERE p.gender='MALE'"));
        }
        assertThat(ranking.count(RankingType.POPULAR, null, null, null, null)).isEqualTo(200);
        assertThat(ranking.findPage(RankingType.OWNED, null, null, null, null, 0, 20))
                .isNotEqualTo(ranking.findPage(RankingType.WISH, null, null, null, null, 0, 20));
        assertThat(count("SELECT count(*) FROM perfume_reviews r JOIN users u ON u.user_id=r.user_id "
                + "WHERE u.email LIKE '%@seed.hyanghae.test'")).isEqualTo(22);
    }

    @Test
    void resetRestoresSeedFieldsWithoutDeletingManualChildrenOrAccounts() throws Exception {
        seed(false);
        long actor = count("SELECT user_id FROM users WHERE email='demo41@demo.hyanghae.test'");
        long shelf = count("SELECT min(user_perfumes_id) FROM user_perfumes WHERE user_id=?", actor);
        String initialStatus = jdbc.queryForObject("SELECT ownership_status FROM user_perfumes WHERE user_perfumes_id=?", String.class, shelf);
        long post = count("SELECT min(post_id) FROM posts");
        String initialTitle = jdbc.queryForObject("SELECT title FROM posts WHERE post_id=?", String.class, post);
        jdbc.update("UPDATE user_perfumes SET ownership_status='WISH', is_representative=false WHERE user_perfumes_id=?", shelf);
        jdbc.update("UPDATE posts SET title='직접 수정한 제목' WHERE post_id=?", post);
        long comment = jdbc.queryForObject("INSERT INTO comments(post_id,user_id,content,created_at,updated_at) "
                + "VALUES (?,?,'직접 추가한 댓글',now(),now()) RETURNING comment_id", Long.class, post, actor);
        long collection = jdbc.queryForObject("INSERT INTO collections(user_id,name) VALUES (?,'직접 만든 컬렉션') RETURNING collection_id", Long.class, actor);
        jdbc.update("INSERT INTO collection_perfumes(collection_id,user_perfume_id,display_order) VALUES (?,?,0)", collection, shelf);
        long views = count("SELECT count(*) FROM user_perfume_views");
        jdbc.update("DELETE FROM user_perfume_views WHERE perfume_view_id=(SELECT min(perfume_view_id) FROM user_perfume_views)");
        seed(false);
        assertThat(jdbc.queryForObject("SELECT title FROM posts WHERE post_id=?", String.class, post)).isEqualTo("직접 수정한 제목");
        assertThat(count("SELECT count(*) FROM user_perfume_views")).isEqualTo(views);
        seed(true);
        assertThat(jdbc.queryForObject("SELECT title FROM posts WHERE post_id=?", String.class, post)).isEqualTo(initialTitle);
        assertThat(jdbc.queryForObject("SELECT ownership_status FROM user_perfumes WHERE user_perfumes_id=?", String.class, shelf)).isEqualTo(initialStatus);
        assertThat(count("SELECT count(*) FROM comments WHERE comment_id=?", comment)).isOne();
        assertThat(count("SELECT count(*) FROM collection_perfumes WHERE collection_id=? AND user_perfume_id=?", collection, shelf)).isOne();
        assertThat(count("SELECT count(*) FROM users WHERE user_id=?", actor)).isOne();
        Map<String, Long> resetCounts = counts();
        seed(true);
        assertThat(counts()).isEqualTo(resetCounts);
    }

    @Test
    void missingImageFailsBeforeAnyActivityOrRegistryIsCreated() {
        jdbc.update("DELETE FROM perfume_images WHERE image_id=(SELECT min(image_id) FROM perfume_images)");
        assertThatThrownBy(() -> seed(false)).isInstanceOf(IllegalStateException.class);
        assertThat(count("SELECT count(*) FROM users")).isZero();
        assertThat(count("SELECT count(*) FROM pg_namespace WHERE nspname='local_seed'")).isZero();
    }

    @Test
    void resetRollsBackRatherThanOverwritingManualUniqueConflict() throws Exception {
        seed(false);
        long actor = count("SELECT user_id FROM users WHERE email='demo41@demo.hyanghae.test'");
        long collection = count("SELECT min(collection_id) FROM collections");
        String name = jdbc.queryForObject("SELECT name FROM collections WHERE collection_id=?", String.class, collection);
        jdbc.update("UPDATE collections SET name='수정한 이름' WHERE collection_id=?", collection);
        long manual = jdbc.queryForObject("INSERT INTO collections(user_id,name) VALUES (?,?) RETURNING collection_id", Long.class, actor, name);
        long post = count("SELECT min(post_id) FROM posts");
        jdbc.update("UPDATE posts SET title='유지해야 할 제목' WHERE post_id=?", post);
        Map<String, Long> before = counts();
        assertThatThrownBy(() -> seed(true)).isInstanceOf(IllegalStateException.class);
        assertThat(counts()).isEqualTo(before);
        assertThat(count("SELECT count(*) FROM collections WHERE collection_id=?", manual)).isOne();
        assertThat(jdbc.queryForObject("SELECT name FROM collections WHERE collection_id=?", String.class, collection)).isEqualTo("수정한 이름");
        assertThat(jdbc.queryForObject("SELECT title FROM posts WHERE post_id=?", String.class, post)).isEqualTo("유지해야 할 제목");
    }

    @Test
    void changedLegacyBoundaryIsPreservedAndReported() throws Exception {
        seed(false);
        long review = count("SELECT min(r.id) FROM perfume_reviews r JOIN users u ON u.user_id=r.user_id WHERE u.email LIKE '%@seed.hyanghae.test'");
        jdbc.update("DELETE FROM perfume_reviews WHERE id=?", review);
        Map<String, Long> before = counts();
        assertThatThrownBy(() -> seed(false)).isInstanceOf(IllegalStateException.class);
        assertThat(counts()).isEqualTo(before);
    }

    @Test
    void fillTopsUpRankingAfterManualOwnershipChanges() throws Exception {
        seed(false);
        long perfume = count("SELECT min(perfume_id) FROM user_perfumes");
        jdbc.update("UPDATE user_perfumes SET ownership_status='WISH', is_representative=false WHERE perfume_id=?", perfume);
        seed(false);
        assertThat(count("SELECT count(*) FROM user_perfumes WHERE perfume_id=? AND ownership_status='OWNED'", perfume)).isEqualTo(3);
        Map<String, Long> before = counts();
        seed(false);
        assertThat(counts()).isEqualTo(before);
    }

    @Test
    void demoSeedUsesSeparateRegistryAndPresentationCopyWithoutLegacyTestUsers() throws Exception {
        LocalSeed.runDemo(url, user, password, DATA, HASH);
        long records = count("SELECT count(*) FROM demo_seed.records");

        assertThat(records).isPositive();
        assertThat(count("SELECT count(*) FROM pg_namespace WHERE nspname='local_seed'")).isZero();
        assertThat(count("SELECT count(*) FROM users WHERE email LIKE '%@demo.hyanghae.test'")).isEqualTo(43);
        assertThat(count("SELECT count(*) FROM users WHERE email LIKE '%@seed.hyanghae.test'")).isZero();
        assertThat(count("SELECT count(*) FROM collections")).isEqualTo(30);
        assertThat(count("SELECT count(*) FROM posts")).isEqualTo(90);
        assertThat(count("SELECT count(*) FROM posts WHERE content LIKE '%로컬 화면 확인%'")).isZero();
        assertThat(count("SELECT count(*) FROM collections WHERE description LIKE '%테스트%'")).isZero();
        assertThat(count("SELECT count(DISTINCT user_id) FROM collections")).isGreaterThan(20);
        assertThat(count("SELECT count(DISTINCT user_id) FROM posts")).isGreaterThan(20);
        assertThat(count("SELECT count(*) FROM user_perfumes s JOIN users u USING(user_id) WHERE u.email='demo41@demo.hyanghae.test'")).isEqualTo(18);
        assertThat(count("SELECT count(*) FROM collections c JOIN users u USING(user_id) WHERE u.email='demo41@demo.hyanghae.test'")).isEqualTo(3);
        assertThat(count("SELECT count(*) FROM posts WHERE created_at > now()")).isZero();
        assertThat(count("SELECT count(*) FROM comments c JOIN posts p USING(post_id) WHERE c.created_at < p.created_at")).isZero();
        assertThat(count("SELECT count(DISTINCT title) FROM posts")).isEqualTo(90);

        LocalSeed.runDemo(url, user, password, DATA, HASH);
        assertThat(count("SELECT count(*) FROM demo_seed.records")).isEqualTo(records);
    }
}
