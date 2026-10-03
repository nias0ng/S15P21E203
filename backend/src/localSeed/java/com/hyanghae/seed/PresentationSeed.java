package com.hyanghae.seed;

import static com.hyanghae.seed.SeedStore.*;
import static com.hyanghae.seed.PresentationData.require;

import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.sql.Connection;
import java.sql.DriverManager;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.*;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;

/** 440번 시연 데이터. 기본은 읽기 전용 plan, 전체 정리는 명시적인 replace에서만 수행합니다. */
public final class PresentationSeed {
    static final String MINSU = "minsu@demo.hyanghae.test";
    static final String YEJIN = "yejin@demo.hyanghae.test";
    // 새 테이블이 생기면 자동으로 지우지 않고 분류를 요구합니다. CASCADE도 사용하지 않습니다.
    static final List<String> ACTIVITY = List.of(
            "users", "user_perfumes", "memos", "collections", "collection_perfumes",
            "posts", "post_images", "post_perfumes", "comments", "post_likes",
            "perfume_reviews", "perfume_review_seasons", "review_likes", "perfume_review_keywords",
            "review_keywords", "perfume_review_summaries", "perfume_review_summary_translations",
            "map_exploration_states", "map_exploration_logs",
            "user_preference_regions", "user_taste_tests", "user_taste_test_selections",
            "user_taste_feature_scores", "user_map_interactions", "user_perfume_views",
            "personalized_recommendation_exposures", "personalized_recommendation_cache_states",
            "personalized_recommendation_candidates", "personalized_recommendation_offers",
            "nlr_recommendations", "nlr_recommendation_items", "nlr_unmatched_expressions", "nlr_feedbacks");
    static final Set<String> CATALOG = Set.of(
            "flyway_schema_history", "brands", "notes", "accords", "seasons", "scent_regions",
            "post_categories", "map_interaction_types", "perfumes", "perfume_prices", "perfume_images",
            "perfume_notes", "perfume_accords", "perfume_neighbors", "perfume_similars", "perfume_map_points",
            "perfume_scent_families");

    private final Connection db;
    private final PresentationData data;
    private final Map<String, Long> perfumes;
    private final Map<Integer, Long> users = new HashMap<>();
    private final OffsetDateTime base;
    private final String hash;

    private PresentationSeed(Connection db, PresentationData data, Map<String, Long> perfumes,
                             OffsetDateTime base, String hash) {
        this.db = db;
        this.data = data;
        this.perfumes = perfumes;
        this.base = base;
        this.hash = hash;
    }

    public static void main(String[] args) {
        try {
            String mode = System.getenv().getOrDefault("SEED_MODE", "plan");
            require(Set.of("plan", "replace", "verify", "verify-summaries", "reset-actors").contains(mode), "SEED_MODE");
            PresentationData data = PresentationData.load(Path.of(System.getenv().getOrDefault(
                    "SEED_DATA_DIR", "db/seed/presentation")));
            String hash = null;
            if (Set.of("replace", "reset-actors").contains(mode)) {
                String expected = mode.equals("replace") ? "REPLACE_ALL_ACTIVITY" : "RESET_DEMO_ACTORS";
                require(expected.equals(required("PRESENTATION_SEED_CONFIRM")), "작업 확인값");
                String password = required("SEED_LOGIN_PASSWORD");
                require(password.length() >= 8 && password.length() <= 64
                        && password.getBytes(StandardCharsets.UTF_8).length <= 72, "계정 비밀번호 길이");
                hash = new BCryptPasswordEncoder().encode(password);
                if (mode.equals("replace")) validateBackup(Path.of(required("SEED_BACKUP_FILE")));
            }
            try (Connection db = DriverManager.getConnection(required("SEED_JDBC_URL"), required("SEED_DB_USER"),
                    required("SEED_DB_PASSWORD"))) {
                if (hash != null) require(required("SEED_EXPECT_DATABASE").equals(
                        query(db, "SELECT current_database() AS name").getFirst().get("name")), "대상 DB 이름");
                execute(db, mode, data, hash, OffsetDateTime.now(ZoneOffset.UTC));
            }
        } catch (Exception failure) {
            // JDBC 오류 원문에는 실제 사용자 행/해시/접속 정보가 포함될 수 있습니다.
            System.err.println("Presentation seed failed: " + (failure instanceof java.sql.SQLException sql
                    ? "SQLSTATE=" + sql.getSQLState() : failure instanceof IllegalStateException
                    ? failure.getMessage() : failure.getClass().getSimpleName()));
            System.exit(1);
        }
    }

    static void validateBackup(Path path) throws Exception {
        require(Files.isRegularFile(path) && Files.size(path) > 1024, "백업 파일 존재/크기");
        try (var input = Files.newInputStream(path)) {
            require(Arrays.equals(input.readNBytes(5), "PGDMP".getBytes(StandardCharsets.US_ASCII)), "pg_dump -Fc 백업 형식");
        }
    }

    static void execute(Connection db, String mode, PresentationData data, String hash, OffsetDateTime now) throws Exception {
        require(Set.of("plan", "replace", "verify", "verify-summaries", "reset-actors").contains(mode), "실행 모드");
        db.setAutoCommit(false);
        try {
            if (Set.of("plan", "verify", "verify-summaries").contains(mode)) {
                SeedStore.execute(db, "SET TRANSACTION READ ONLY");
            } else {
                require(hash != null && !hash.isBlank(), "비밀번호 해시");
                SeedStore.execute(db, "SET LOCAL lock_timeout = '10s'");
                SeedStore.execute(db, "SELECT pg_advisory_xact_lock(274, 156)");
                SeedStore.execute(db, "LOCK TABLE " + String.join(",", ACTIVITY) + " IN ACCESS EXCLUSIVE MODE");
            }
            validateSchema(db);
            Map<String, Long> perfumes = resolve(db, data);
            PresentationSeed seed = new PresentationSeed(db, data, perfumes, now.minusDays(45), hash);
            if (mode.equals("plan")) {
                System.out.println("READ ONLY: " + data.manifest.version());
                for (String table : ACTIVITY) System.out.printf("정리 대상 %s: %d행%n", table, count(db, "SELECT count(*) FROM " + table));
                for (var target : data.manifest.perfumes()) System.out.printf("향수 %s: DB ID=%d, 외부 ID=%d, 후기=%d%n",
                        target.name(), perfumes.get(target.key()), target.externalId(), target.reviewCount());
                System.out.printf("신규 계정 34명, 후기 %d개, 컬렉션 %d개, 게시글 %d개, 댓글 %d개%n",
                        data.reviews.size(), data.manifest.collections().size(), data.manifest.posts().size(),
                        data.manifest.posts().stream().mapToInt(p -> p.comments().size()).sum());
            } else if (mode.equals("replace")) {
                // 한 트랜잭션에서 정리와 새 데이터를 검증합니다. identity는 재사용하지 않습니다.
                SeedStore.execute(db, "TRUNCATE TABLE " + String.join(",", ACTIVITY) + " RESTRICT");
                for (String schema : List.of("local_seed", "demo_seed")) {
                    if (exists(db, schema + ".records")) SeedStore.execute(db, "DELETE FROM " + schema + ".records");
                }
                SeedStore.execute(db, "CREATE SCHEMA IF NOT EXISTS presentation_seed");
                SeedStore.execute(db, "CREATE TABLE IF NOT EXISTS presentation_seed.run (singleton boolean PRIMARY KEY CHECK(singleton), "
                        + "version text NOT NULL, applied_at timestamptz NOT NULL, minsu_id bigint NOT NULL, yejin_id bigint NOT NULL)");
                seed.populate();
                long minsu = seed.actor(MINSU, "민수");
                long yejin = seed.actor(YEJIN, "예진");
                seed.yejinShelf(yejin);
                SeedStore.execute(db, "INSERT INTO presentation_seed.run VALUES(true,?,?,?,?) ON CONFLICT(singleton) "
                        + "DO UPDATE SET version=excluded.version, applied_at=excluded.applied_at, minsu_id=excluded.minsu_id, yejin_id=excluded.yejin_id",
                        data.manifest.version(), now, minsu, yejin);
                seed.verify(true);
            } else if (mode.equals("reset-actors")) {
                seed.resetActors(now);
                seed.verify(true);
            } else {
                seed.verify(false);
                if (mode.equals("verify-summaries")) seed.verifySummaries();
            }
            db.commit();
            System.out.println("완료: " + mode + ". 요약은 실제 배치 실행 후 별도로 확인하세요.");
        } catch (Exception failure) {
            db.rollback();
            throw failure;
        } finally {
            db.setAutoCommit(true);
        }
    }

    private static boolean exists(Connection db, String relation) throws Exception {
        return query(db, "SELECT to_regclass(?) IS NOT NULL AS present", relation).getFirst().get("present").equals(true);
    }

    static void validateSchema(Connection db) throws Exception {
        Set<String> actual = new HashSet<>();
        for (var row : query(db, "SELECT tablename FROM pg_tables WHERE schemaname='public'")) actual.add(row.get("tablename").toString());
        Set<String> expected = new HashSet<>(CATALOG);
        expected.addAll(ACTIVITY);
        require(actual.equals(expected), "알 수 없거나 누락된 public 테이블: " + difference(actual, expected));
    }

    private static Set<String> difference(Set<String> a, Set<String> b) {
        Set<String> result = new TreeSet<>(a);
        result.addAll(b);
        Set<String> common = new HashSet<>(a);
        common.retainAll(b);
        result.removeAll(common);
        return result;
    }

    static Map<String, Long> resolve(Connection db, PresentationData data) throws Exception {
        Map<String, Long> result = new LinkedHashMap<>();
        for (var target : data.manifest.perfumes()) {
            var rows = query(db, "SELECT p.perfume_id FROM perfumes p JOIN brands b ON b.brand_id=p.brand_id "
                    + "WHERE p.fragrantica_id=? AND p.name=? AND b.name=? AND p.is_active=true",
                    target.externalId(), target.name(), target.brand());
            require(rows.size() == 1, "카탈로그 향수 식별: " + target.key());
            result.put(target.key(), number(rows.getFirst(), "perfume_id"));
        }
        require(count(db, "SELECT count(DISTINCT code) FROM seasons WHERE is_active AND code IN ('SPRING','SUMMER','AUTUMN','WINTER')") == 4,
                "계절 기준 데이터");
        require(count(db, "SELECT count(DISTINCT code) FROM post_categories WHERE is_active AND code IN ('CHAT','RECOMMEND','COLLECTION')") == 3,
                "게시판 기준 데이터");
        return result;
    }

    private long insert(String table, String pk, Map<String, Object> values) throws Exception {
        String placeholders = String.join(",", Collections.nCopies(values.size(), "?"));
        return number(query(db, "INSERT INTO " + table + " (" + String.join(",", values.keySet()) + ") VALUES ("
                + placeholders + ") RETURNING " + pk, values.values().toArray()).getFirst(), pk);
    }

    private OffsetDateTime time(int days, int minutes) { return base.plusDays(days).plusMinutes(minutes); }
    private long user(String email, String nickname, OffsetDateTime created) throws Exception {
        return insert("users", "user_id", row("email", email, "nickname", nickname, "password_hash", hash,
                "created_at", created, "updated_at", created));
    }
    private long actor(String email, String nickname) throws Exception { return user(email, nickname, time(44, 0)); }

    private long shelf(long user, String key, String status, OffsetDateTime created) throws Exception {
        var existing = query(db, "SELECT user_perfumes_id FROM user_perfumes WHERE user_id=? AND perfume_id=?", user, perfumes.get(key));
        if (!existing.isEmpty()) return number(existing.getFirst(), "user_perfumes_id");
        return insert("user_perfumes", "user_perfumes_id", row("user_id", user, "perfume_id", perfumes.get(key),
                "ownership_status", status, "is_representative", false, "created_at", created, "updated_at", created));
    }

    private void yejinShelf(long yejin) throws Exception {
        for (String key : List.of("ari", "candy", "flowerbomb")) shelf(yejin, key, "OWNED", time(44, 60));
    }

    private void populate() throws Exception {
        for (int i = 1; i <= 32; i++) users.put(i, user("extra%02d@demo.hyanghae.test".formatted(i),
                data.manifest.nicknames().get(i - 1), time(0, i * 13)));
        int index = 0;
        for (var review : data.reviews) {
            int n = index++;
            long author = users.get(review.author());
            OffsetDateTime written = time(12 + n * 7 % 26, n * 11 % 600);
            if (Set.of("OWNED", "WISH").contains(review.experience())) {
                shelf(author, review.perfume(), review.experience(), time(4 + n % 7, n));
            }
            long id = insert("perfume_reviews", "id", row("user_id", author, "perfume_id", perfumes.get(review.perfume()),
                    "title", review.title(), "content", review.content(), "created_at", written, "updated_at", written,
                    "view_count", 5 + n * 13 % 67));
            SeedStore.execute(db, "INSERT INTO perfume_review_seasons SELECT ?,season_id FROM seasons WHERE code=?",
                    id, review.season());
            for (int like = 0; like < n % 4; like++) SeedStore.execute(db,
                    "INSERT INTO review_likes(review_id,user_id,created_at) VALUES(?,?,?)", id,
                    users.get(1 + (review.author() + like * 3) % 32), written.plusHours(like + 2));
            insert("user_perfume_views", "perfume_view_id", row("user_id", author, "perfume_id", perfumes.get(review.perfume()),
                    "from_location_type", "SEARCH", "viewed_at", written.minusHours(2),
                    "exited_at", written.minusHours(2).plusSeconds(35 + n % 80), "duration_seconds", 35 + n % 80));
        }
        Map<String, Long> collections = new HashMap<>();
        Map<String, String> names = new HashMap<>();
        for (var collection : data.manifest.collections()) {
            long owner = users.get(collection.owner());
            long id = insert("collections", "collection_id", row("user_id", owner, "name", collection.name(),
                    "description", collection.description(), "created_at", time(38, 0), "updated_at", time(38, 0)));
            collections.put(collection.key(), id);
            names.put(collection.key(), collection.name());
            int order = 0;
            for (String key : collection.perfumes()) {
                long item = shelf(owner, key, "WISH", time(10, 0));
                SeedStore.execute(db, "INSERT INTO collection_perfumes VALUES(?,?,?,?)", id, item, order++, time(38, 0));
            }
        }
        int postIndex = 0;
        for (var post : data.manifest.posts()) {
            int n = postIndex++;
            OffsetDateTime posted = time(39 + n % 4, n * 41);
            long category = number(query(db, "SELECT category_id FROM post_categories WHERE code=?", post.category()).getFirst(), "category_id");
            long id = insert("posts", "post_id", row("user_id", users.get(post.owner()), "category_id", category,
                    "title", post.title(), "content", post.content(), "collection_id", collections.get(post.collection()),
                    "collection_name", names.get(post.collection()), "created_at", posted, "updated_at", posted, "view_count", 9 + n * 7));
            int order = 0;
            for (String key : post.perfumes()) SeedStore.execute(db, "INSERT INTO post_perfumes VALUES(?,?,?)", id, perfumes.get(key), order++);
            int commentIndex = 0;
            for (var comment : post.comments()) {
                OffsetDateTime commented = posted.plusHours(++commentIndex * 2L);
                insert("comments", "comment_id", row("post_id", id, "user_id", users.get(comment.author()),
                        "content", comment.content(), "created_at", commented, "updated_at", commented));
            }
            for (int like = 0; like < n % 4; like++) SeedStore.execute(db,
                    "INSERT INTO post_likes(post_id,user_id,created_at) VALUES(?,?,?)", id,
                    users.get(1 + (post.owner() + like) % 32), posted.plusHours(like + 1));
        }
    }

    private void resetActors(OffsetDateTime now) throws Exception {
        require(exists(db, "presentation_seed.run"), "시연 계정 초기화 전 replace 필요");
        var runs = query(db, "SELECT * FROM presentation_seed.run WHERE singleton");
        require(runs.size() == 1 && data.manifest.version().equals(runs.getFirst().get("version")), "시연 데이터 버전");
        var run = runs.getFirst();
        for (String role : List.of("minsu", "yejin")) {
            long id = number(run, role + "_id");
            require(count(db, "SELECT count(*) FROM users WHERE user_id=? AND email=?", id, role + "@demo.hyanghae.test") == 1,
                    "시연 계정 식별: " + role);
            SeedStore.execute(db, "DELETE FROM perfume_review_summary_translations WHERE perfume_id IN (SELECT perfume_id FROM perfume_reviews WHERE user_id=?)", id);
            SeedStore.execute(db, "DELETE FROM perfume_review_summaries WHERE perfume_id IN (SELECT perfume_id FROM perfume_reviews WHERE user_id=?)", id);
            SeedStore.execute(db, "DELETE FROM perfume_reviews WHERE user_id=?", id);
            SeedStore.execute(db, "DELETE FROM posts WHERE user_id=?", id);
            SeedStore.execute(db, "DELETE FROM comments WHERE user_id=?", id);
            SeedStore.execute(db, "DELETE FROM nlr_recommendations WHERE user_id=?", id);
            SeedStore.execute(db, "DELETE FROM user_perfumes WHERE user_id=?", id);
            SeedStore.execute(db, "DELETE FROM users WHERE user_id=?", id);
        }
        // 새 ID를 발급해 이전 세션 토큰이 새 시연 계정을 가리키지 않게 합니다.
        long minsu = user(MINSU, "민수", now.minusHours(1));
        long yejin = user(YEJIN, "예진", now.minusHours(1));
        for (String key : List.of("ari", "candy", "flowerbomb")) shelf(yejin, key, "OWNED", now.minusMinutes(30));
        SeedStore.execute(db, "UPDATE presentation_seed.run SET minsu_id=?,yejin_id=? WHERE singleton", minsu, yejin);
    }

    private void verify(boolean rehearsalReady) throws Exception {
        require(exists(db, "presentation_seed.run") && count(db,
                "SELECT count(*) FROM presentation_seed.run WHERE singleton AND version=?", data.manifest.version()) == 1,
                "적재된 시연 데이터 버전");
        for (var target : data.manifest.perfumes()) {
            long actual = count(db, "SELECT count(*) FROM perfume_reviews r JOIN users u ON u.user_id=r.user_id "
                    + "WHERE r.perfume_id=? AND u.email LIKE 'extra%@demo.hyanghae.test'", perfumes.get(target.key()));
            require(actual == target.reviewCount(), "배경 후기 수: " + target.key());
        }
        require(count(db, "SELECT count(*) FROM users WHERE email LIKE 'extra%@demo.hyanghae.test'") == 32, "배경 계정 수");
        require(count(db, "SELECT count(*) FROM comments c JOIN posts p ON p.post_id=c.post_id WHERE c.created_at<p.created_at") == 0, "댓글 시간 순서");
        require(count(db, "SELECT count(*) FROM collection_perfumes cp JOIN collections c USING(collection_id) "
                + "JOIN user_perfumes up ON up.user_perfumes_id=cp.user_perfume_id WHERE c.user_id<>up.user_id") == 0, "컬렉션 소유자");
        require(count(db, "SELECT count(*) FROM users WHERE email IN (?,?)", MINSU, YEJIN) == 2, "시연 계정 존재");
        if (rehearsalReady) {
            require(count(db, "SELECT count(*) FROM user_perfumes up JOIN users u USING(user_id) WHERE u.email=?", MINSU) == 0, "민수의 빈 진열대");
            require(count(db, "SELECT count(*) FROM user_taste_tests t JOIN users u USING(user_id) WHERE u.email=?", MINSU) == 0, "민수 취향 테스트 초기 상태");
            require(count(db, "SELECT count(*) FROM user_perfumes up JOIN users u USING(user_id) WHERE u.email=? AND perfume_id=?", YEJIN, perfumes.get("cloud")) == 0,
                    "예진 클라우드 미저장");
            require(count(db, "SELECT count(*) FROM perfume_reviews r JOIN users u USING(user_id) WHERE u.email IN (?,?)", MINSU, YEJIN) == 0, "시연 계정 미작성 후기");
            require(count(db, "SELECT count(*) FROM collections c JOIN users u USING(user_id) WHERE u.email IN (?,?)", MINSU, YEJIN) == 0, "시연 중 만들 컬렉션");
        }
    }

    private void verifySummaries() throws Exception {
        for (var target : data.manifest.perfumes()) {
            if (target.reviewCount() < 5) continue;
            var summaries = query(db, "SELECT s.source_review_count, s.updated_at, "
                    + "(SELECT count(*) FROM perfume_reviews r WHERE r.perfume_id=s.perfume_id) AS actual "
                    + "FROM perfume_review_summaries s WHERE s.perfume_id=? AND NULLIF(btrim(s.summary_text),'') IS NOT NULL",
                    perfumes.get(target.key()));
            require(summaries.size() == 1, "실제 AI 요약 생성 필요: " + target.key());
            var summary = summaries.getFirst();
            long source = number(summary, "source_review_count");
            // 현장 후기 한 건 추가 후에도 기존 요약은 유효합니다. 원문 삭제/교체 뒤에는 재생성이 필요합니다.
            require(source >= target.reviewCount() && source <= number(summary, "actual")
                    && summary.get("updated_at") != null, "요약 기준 후기 수/시각: " + target.key());
            System.out.printf("요약 준비: %s, 기준 후기 %d개, 현재 %d개, 갱신 %s%n",
                    target.name(), source, number(summary, "actual"), summary.get("updated_at"));
        }
    }

    private static String required(String name) {
        String value = System.getenv(name);
        require(value != null && !value.isBlank(), name + " 환경변수 필요");
        return value;
    }
}
