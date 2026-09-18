package com.hyanghae.seed;

import static com.hyanghae.seed.SeedStore.*;

import java.nio.file.Files;
import java.nio.file.Path;
import java.sql.Connection;
import java.sql.DriverManager;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.TreeMap;
import org.flywaydb.core.Flyway;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;

/** 서버와 독립적으로 실행하는 로컬 전용 데이터 도구. 앱의 인증이나 API를 우회하는 코드는 없습니다. */
public final class LocalSeed {
    private static final OffsetDateTime BASE = OffsetDateTime.parse("2026-09-01T09:00:00+09:00");
    private static final String DOMAIN = "@demo.hyanghae.test";
    private final Connection db;
    private final SeedStore store;
    private final long[] users = new long[44];
    private final List<Perfume> perfumes;
    private final Set<Long> protectedReviews;
    private final Map<Long, Long> demoShelf = new HashMap<>();
    private final String passwordHash;
    private final SeedOptions options;
    private final OffsetDateTime demoBase = OffsetDateTime.now().minusDays(48);

    record Perfume(long id, long externalId, String name) {}
    record SeedOptions(String registrySchema, boolean includeLegacyReviews, boolean presentationText, String label) {}

    private LocalSeed(Connection db, boolean reset, List<Perfume> perfumes,
            Set<Long> protectedReviews, String passwordHash, SeedOptions options) throws java.sql.SQLException {
        this.db = db;
        this.store = new SeedStore(db, reset, options.registrySchema());
        this.perfumes = perfumes;
        this.protectedReviews = protectedReviews;
        this.passwordHash = passwordHash;
        this.options = options;
    }

    public static void main(String[] args) throws Exception {
        String url = required("SEED_JDBC_URL");
        String user = required("SEED_DB_USER");
        String dbPassword = required("SEED_DB_PASSWORD");
        String password = required("SEED_LOGIN_PASSWORD");
        String mode = System.getenv().getOrDefault("SEED_MODE", "fill");
        if (!Set.of("fill", "reset").contains(mode)) throw new IllegalArgumentException("SEED_MODE는 fill 또는 reset입니다.");
        if (!"manual-test".equals(System.getenv("SEED_ENV"))) {
            throw new IllegalArgumentException("SEED_ENV=manual-test인 로컬 환경에서만 실행합니다.");
        }
        if (password.length() < 8 || password.length() > 64
                || password.getBytes(java.nio.charset.StandardCharsets.UTF_8).length > 72) {
            throw new IllegalArgumentException("테스트 비밀번호는 8~64자, UTF-8 기준 72바이트 이하로 지정하세요.");
        }
        try (Connection db = DriverManager.getConnection(url, user, dbPassword)) {
            String dbName = query(db, "SELECT current_database() AS name").getFirst().get("name").toString();
            if (!dbName.endsWith("_test")) throw new IllegalArgumentException("이름이 _test로 끝나는 DB에서만 실행합니다.");
        }
        run(url, user, dbPassword, Path.of(System.getenv().getOrDefault("SEED_DATA_DIR", "db/seed")),
                mode.equals("reset"), new BCryptPasswordEncoder().encode(password));
    }

    static void run(String url, String user, String dbPassword, Path directory,
            boolean reset, String hash) throws Exception {
        run(url, user, dbPassword, directory, reset, hash,
                new SeedOptions("local_seed", true, false, "로컬 seed"));
    }

    static void runDemo(String url, String user, String dbPassword, Path directory, String hash) throws Exception {
        run(url, user, dbPassword, directory, false, hash,
                new SeedOptions("demo_seed", false, true, "데모 seed"));
    }

    private static void run(String url, String user, String dbPassword, Path directory,
            boolean reset, String hash, SeedOptions options) throws Exception {
        try (Connection db = DriverManager.getConnection(url, user, dbPassword)) {
            // 동일 DB에 두 도구가 동시에 기록하지 않도록 Flyway 이전부터 잠급니다.
            execute(db, "SELECT pg_advisory_lock(274, 156)");
            List<Perfume> perfumes = targets(db, directory);
            Flyway.configure().dataSource(url, user, dbPassword).defaultSchema(options.registrySchema())
                    .schemas(options.registrySchema()).locations("classpath:local-seed-migration").load().migrate();
            db.setAutoCommit(false);
            try {
                // 읽기 화면은 허용하되 실행 중 앱 쓰기와 경합하여 스냅샷/제약이 엇갈리지 않게 합니다.
                execute(db, "LOCK TABLE users, user_perfumes, collections, collection_perfumes, "
                        + "memos, posts, post_perfumes, post_images, comments, post_likes, "
                        + "perfume_reviews, perfume_review_seasons, review_likes, user_perfume_views "
                        + "IN SHARE ROW EXCLUSIVE MODE");
                Set<Long> protectedIds = options.includeLegacyReviews()
                        ? legacyReviews(db, directory) : Set.of();
                LocalSeed seed = new LocalSeed(db, reset, perfumes, protectedIds, hash, options);
                if (reset) {
                    // 대표 향수끼리 교체할 때의 중간 UNIQUE 충돌만 해소합니다. 수동 생성 행은 제외합니다.
                    execute(db, "UPDATE user_perfumes t SET is_representative = false "
                            + "WHERE EXISTS (SELECT 1 FROM " + options.registrySchema() + ".records r "
                            + "WHERE r.table_name='user_perfumes' AND t.user_perfumes_id=(r.primary_key->>'user_perfumes_id')::bigint)");
                }
                seed.populate();
                seed.verify();
                db.commit();
                System.out.printf("%s 완료: 향수 156개, 새로 삽입/복원 %d행, 초기값 갱신 %d행%n",
                        options.label(), seed.store.inserted, seed.store.restored);
                System.out.println("활동 계정: demo41@demo.hyanghae.test / 다른 사용자: demo42@demo.hyanghae.test");
                System.out.println("빈 계정: demo43@demo.hyanghae.test (직접 활동했다면 그 기록은 유지됩니다)");
                System.out.println("비밀번호는 최초 생성 시의 SEED_LOGIN_PASSWORD입니다.");
            } catch (Exception failure) {
                db.rollback();
                // JDBC 오류 원문에는 행/비밀번호 해시가 포함될 수 있어 출력하지 않습니다.
                throw new IllegalStateException("seed 변경을 모두 취소했습니다. 원인: "
                        + (failure instanceof java.sql.SQLException sql ? "SQLSTATE=" + sql.getSQLState()
                        : failure instanceof IllegalStateException ? failure.getMessage() : failure.getClass().getSimpleName())
                        + ". 기존 후기 6/12/4건, 수동 데이터와의 중복·대표 향수 충돌, 선행 데이터 상태를 확인하세요.");
            } finally {
                db.setAutoCommit(true);
                execute(db, "SELECT pg_advisory_unlock(274, 156)");
            }
        }
    }

    private static String required(String name) {
        String value = System.getenv(name);
        if (value == null || value.isBlank()) throw new IllegalArgumentException(name + " 환경변수가 필요합니다.");
        return value;
    }

    private static List<Perfume> targets(Connection db, Path directory) throws Exception {
        // manifest의 앞 두 열은 숫자입니다. 이름/설명 등 CSV 문자열을 직접 파싱하지 않습니다.
        Map<Long, Integer> manifest = new TreeMap<>();
        List<String> lines = Files.readAllLines(directory.resolve("perfume_images.csv"));
        for (String line : lines.subList(1, lines.size())) {
            if (line.isBlank()) continue;
            String[] columns = line.split(",", 3);
            long externalId = Long.parseLong(columns[1].replace("\"", ""));
            int rank = Integer.parseInt(columns[0].replace("\"", ""));
            Integer previous = manifest.put(externalId, rank);
            if (previous != null && previous != rank) throw new IllegalStateException("이미지 manifest 순위 불일치");
        }
        if (manifest.size() != 156) throw new IllegalStateException("이미지 manifest의 대상 향수가 156개가 아닙니다.");
        List<Perfume> result = new ArrayList<>();
        for (var entry : manifest.entrySet()) {
            var found = query(db, "SELECT p.perfume_id, p.name FROM perfumes p "
                    + "WHERE p.fragrantica_id=? AND p.korea_selection_rank=? AND p.is_active "
                    + "AND (SELECT count(DISTINCT i.image_type) FROM perfume_images i "
                    + "WHERE i.perfume_id=p.perfume_id AND i.image_type IN ('ORIGINAL','PAPER_TEXTURE') "
                    + "AND NULLIF(btrim(i.image_url),'') IS NOT NULL)=2", entry.getKey(), entry.getValue());
            if (found.size() != 1) throw new IllegalStateException("기존 seed를 먼저 적재하세요. 이미지 향수 누락: " + entry.getKey());
            result.add(new Perfume(number(found.getFirst(), "perfume_id"), entry.getKey(), found.getFirst().get("name").toString()));
        }
        if (count(db, "SELECT count(*) FROM seasons WHERE is_active") != 4
                || count(db, "SELECT count(*) FROM post_categories WHERE is_active "
                + "AND code IN ('COLLECTION','RECOMMEND','CHAT')") != 3) {
            throw new IllegalStateException("Flyway 기준 데이터(계절 4개, 게시판 분류 3개)를 확인하세요.");
        }
        return result;
    }

    private static Set<Long> legacyReviews(Connection db, Path directory) throws Exception {
        if (count(db, "SELECT count(*) FROM users WHERE email LIKE '%@seed.hyanghae.test'") == 0) {
            // 기존 SQL을 재사용합니다. psql 출력 명령과 트랜잭션 제어만 빼고 현재 트랜잭션에 포함합니다.
            String sql = Files.readAllLines(directory.resolve("load_review_seed.sql")).stream()
                    .filter(line -> !line.stripLeading().startsWith("\\"))
                    .filter(line -> !Set.of("BEGIN;", "COMMIT;").contains(line.strip()))
                    .collect(java.util.stream.Collectors.joining("\n"));
            execute(db, sql);
        }
        var rows = query(db, "SELECT r.perfume_id, count(*) AS n FROM perfume_reviews r "
                + "WHERE r.perfume_id IN (SELECT r2.perfume_id FROM perfume_reviews r2 "
                + "JOIN users u ON u.user_id=r2.user_id WHERE u.email LIKE '%@seed.hyanghae.test') "
                + "GROUP BY r.perfume_id ORDER BY n");
        if (rows.size() != 3 || number(rows.get(0), "n") != 4
                || number(rows.get(1), "n") != 6 || number(rows.get(2), "n") != 12) {
            throw new IllegalStateException("기존 후기 seed의 4/6/12건 조건이 변경되어 있습니다.");
        }
        Set<Long> ids = new HashSet<>();
        rows.forEach(r -> ids.add(number(r, "perfume_id")));
        return ids;
    }

    private Map<String, Object> ensure(String key, String table, String id, Map<String, Object> values) throws Exception {
        return store.ensure(key, table, List.of(id), values);
    }

    private void link(String key, String table, String first, long a, String second, long b,
            Object... extras) throws Exception {
        Map<String, Object> values = row(first, a, second, b);
        values.putAll(row(extras));
        // 복합키는 사람이 동일 관계를 이미 추가했을 수 있습니다. 그런 관계를 seed 소유로 취급하지 않습니다.
        if (!store.contains(key)
                && count(db, "SELECT count(*) FROM " + table + " WHERE " + first + "=? AND " + second + "=?", a, b) > 0) return;
        store.ensure(key, table, List.of(first, second), values);
    }

    private static String time(int offset) {
        return BASE.plusMinutes(offset).toString();
    }

    private void populate() throws Exception {
        if (options.presentationText()) {
            populateDemo();
            return;
        }
        for (int u = 1; u <= 43; u++) {
            users[u] = number(ensure("user/" + u, "users", "user_id", row(
                    "email", "demo%02d".formatted(u) + DOMAIN,
                    "password_hash", passwordHash, "nickname", options.presentationText()
                            ? "향해회원%02d".formatted(u) : "테스트항해자%02d".formatted(u),
                    "created_at", time(u), "updated_at", time(u))), "user_id");
        }
        for (int i = 0; i < perfumes.size(); i++) {
            Perfume p = perfumes.get(i);
            for (int u = 1; u <= 40; u++) {
                boolean owned = u <= 20;
                int slot = owned ? u : u - 20;
                int target = owned ? 3 + i % 8 : 3 + (i * 3 + 4) % 8;
                String key = "shelf/" + p.externalId + "/" + u;
                if (slot <= target || store.contains(key)) {
                    shelf(key, u, p, owned ? "OWNED" : "WISH", i == 0 && owned, i);
                }
            }
            long item = shelf("shelf/" + p.externalId + "/41", 41, p, i % 2 == 0 ? "OWNED" : "WISH", i == 0, i);
            demoShelf.put(p.id, item);
            if (i < 8) shelf("shelf/" + p.externalId + "/42", 42, p, "OWNED", i == 0, i);
            // 최소 3명에 못 미치면 이 향수를 아직 담지 않은 집계용 사용자로 보충합니다.
            for (String status : List.of("OWNED", "WISH")) {
                for (int u = 1; u <= 40 && count(db, "SELECT count(*) FROM user_perfumes WHERE perfume_id=? "
                        + "AND ownership_status=?", p.id, status) < 3; u++) {
                    if (count(db, "SELECT count(*) FROM user_perfumes WHERE user_id=? AND perfume_id=?", users[u], p.id) == 0) {
                        shelf("shelf/" + p.externalId + "/" + u, u, p, status, false, i);
                    }
                }
            }
            if (i % 3 == 0) ensure("memo/" + p.externalId, "memos", "memo_id", row(
                    "user_perfume_id", item, "content", p.name + " — 출근 전에 소량 시향. 잔향을 다시 확인할 예정입니다.",
                    "created_at", time(i), "updated_at", time(i)));
            for (int v = 0; v < 1 + (i * 7) % 30; v++) {
                ensure("view/" + p.externalId + "/" + v, "user_perfume_views", "perfume_view_id", row(
                        "user_id", users[1 + v % 40], "perfume_id", p.id,
                        "from_location_type", "SEARCH", "viewed_at", time(i * 31 + v),
                        "exited_at", BASE.plusMinutes(i * 31L + v).plusSeconds(30).toString(), "duration_seconds", 30));
            }
            if (!protectedReviews.contains(p.id)) reviews(p, i);
        }
        community();
    }

    private long shelf(String key, int user, Perfume p, String status, boolean representative, int offset) throws Exception {
        return number(ensure(key, "user_perfumes", "user_perfumes_id", row(
                "user_id", users[user], "perfume_id", p.id, "ownership_status", status,
                "is_representative", representative, "fit_rating", offset % 4 == 0 ? null : 2.5 + (offset % 6) * 0.5,
                "created_at", time(offset), "updated_at", time(offset))), "user_perfumes_id");
    }

    private void reviews(Perfume p, int i) throws Exception {
        // 0~7건: 빈 후기 화면과 여러 후기 화면을 함께 준비합니다.
        for (int n = 0; n < i % 8; n++) {
            String key = "review/" + p.externalId + "/" + n;
            long id = number(ensure(key, "perfume_reviews", "id", row(
                    "user_id", users[n == 0 ? 41 : n], "perfume_id", p.id,
                    "title", List.of("첫 시향 기록", "하루 사용해 봤어요", "다시 시향하고 싶은 향").get(n % 3),
                    "content", p.name + " 시향 기록입니다. " + List.of(
                            "처음보다 시간이 지난 뒤의 향이 편안하게 느껴졌어요. 출근할 때 소량 사용했습니다.",
                            "실내에서는 조금 진하게 느껴졌습니다. 다음에는 양을 줄여서 사용해 보려고 합니다.",
                            "제 피부와 옷에서 느껴지는 향이 달라 흥미로웠어요. 구매 전 한 번 더 시향하고 싶습니다.").get(n % 3),
                    "view_count", (i * 11 + n) % 80, "created_at", time(i * 10 + n), "updated_at", time(i * 10 + n))), "id");
            long season = number(query(db, "SELECT season_id FROM seasons WHERE code=?",
                    List.of("SPRING", "SUMMER", "AUTUMN", "WINTER").get((i + n) % 4)).getFirst(), "season_id");
            link(key + "/season", "perfume_review_seasons", "review_id", id, "season_id", season);
            for (int like = 0; like < n; like++) link(key + "/like/" + like, "review_likes",
                    "review_id", id, "user_id", users[21 + like], "created_at", time(i * 10 + n + like + 1));
        }
    }

    private void community() throws Exception {
        for (int c = 0; c < 30; c++) {
            String name = List.of("출근할 때", "주말 산책", "저녁 약속").get(c % 3) + " " + (c + 1);
            long collection = number(ensure("collection/" + c, "collections", "collection_id", row(
                    "user_id", users[41], "name", name, "description", options.presentationText()
                            ? "상황과 계절에 맞춰 골라 둔 향수 컬렉션입니다."
                            : "상황에 맞춰 골라 둔 테스트 컬렉션입니다.",
                    "created_at", time(6000 + c), "updated_at", time(6000 + c))), "collection_id");
            for (int j = 0; j < 4; j++) {
                Perfume p = perfumes.get((c * 4 + j) % perfumes.size());
                link("collection/" + c + "/item/" + j, "collection_perfumes", "collection_id", collection,
                        "user_perfume_id", demoShelf.get(p.id), "display_order", j, "created_at", time(6000 + c));
            }
            for (int type = 0; type < 3; type++) {
                String category = List.of("COLLECTION", "RECOMMEND", "CHAT").get(type);
                long categoryId = number(query(db, "SELECT category_id FROM post_categories WHERE code=?", category).getFirst(), "category_id");
                String key = "post/" + c + "/" + type;
                int offset = 7000 + c * 10 + type;
                long post = number(ensure(key, "posts", "post_id", row(
                        "user_id", users[type == 2 ? 42 : 41], "category_id", categoryId,
                        "title", List.of(name + " 컬렉션을 소개합니다", "요즘 손이 가는 향수를 추천해요 " + (c + 1),
                                "오늘은 어떤 향수를 사용하셨나요? " + (c + 1)).get(type),
                        "content", (options.presentationText() ? "" : "로컬 화면 확인을 위한 게시글입니다. ") + List.of(
                                "네 가지 향수를 모아 보았습니다. 계절과 상황에 따라 번갈아 사용하고 있어요.",
                                "최근 시향한 향수 중 다시 써보고 싶은 향수를 골랐습니다. 여러분의 사용 경험도 궁금합니다.",
                                "날씨가 달라지니 손이 가는 향수도 달라지는 것 같아요. 오늘의 향수를 이야기해 주세요.").get(type),
                        "collection_id", type == 0 ? collection : null, "collection_name", type == 0 ? name : null,
                        "view_count", c * 13 % 100, "created_at", time(offset), "updated_at", time(offset))), "post_id");
                for (int j = 0; j < (type == 0 ? 4 : type == 1 ? 1 : 0); j++) {
                    Perfume p = perfumes.get((c * 4 + j) % perfumes.size());
                    link(key + "/perfume/" + j, "post_perfumes", "post_id", post, "perfume_id", p.id, "display_order", j);
                }
                for (int n = 0; n < c % 7; n++) {
                    ensure(key + "/comment/" + n, "comments", "comment_id", row(
                            "post_id", post, "user_id", users[1 + n],
                            "content", List.of("다음 시향 때 참고할게요!", "저도 비슷한 느낌이었어요.", "사용 경험 공유 감사합니다.").get(n % 3),
                            "created_at", time(offset + n + 1), "updated_at", time(offset + n + 1)));
                }
                for (int n = 0; n < c % 11; n++) link(key + "/like/" + n, "post_likes",
                        "post_id", post, "user_id", users[21 + n], "created_at", time(offset + n + 1));
            }
        }
    }

    private String demoTime(int minute) {
        return demoBase.plusMinutes(minute).toString();
    }

    static String demoTitle(String title, int limit) {
        if (title.codePointCount(0, title.length()) <= limit) return title;
        return title.substring(0, title.offsetByCodePoints(0, limit - 1)) + "…";
    }

    private long demoShelf(int u, Perfume p, String status, int minute) throws Exception {
        return number(ensure("shelf/" + p.externalId + "/" + u, "user_perfumes", "user_perfumes_id", row(
                "user_id", users[u], "perfume_id", p.id, "ownership_status", status,
                "is_representative", false, "fit_rating", "WISH".equals(status) ? null : 3.0 + (p.externalId + u) % 5 * 0.5,
                "created_at", demoTime(minute), "updated_at", demoTime(minute))), "user_perfumes_id");
    }

    private void populateDemo() throws Exception {
        for (int u = 1; u <= 43; u++) {
            users[u] = number(ensure("user/" + u, "users", "user_id", row(
                    "email", "demo%02d".formatted(u) + DOMAIN, "password_hash", passwordHash,
                    "nickname", DemoContent.NAMES[u - 1], "created_at", demoTime(u * 17),
                    "updated_at", demoTime(u * 17))), "user_id");
        }
        for (int i = 0; i < perfumes.size(); i++) {
            Perfume p = perfumes.get(i);
            // 향수마다 사용자를 순환하여 일부 계정에 모든 보유 기록이 몰리지 않게 합니다.
            int owned = 3 + i % 3;
            int wished = 3 + (i * 7) % 5;
            for (int slot = 0; slot < owned + wished; slot++) {
                int u = 1 + (i * 13 + slot * 7) % 40;
                demoShelf(u, p, slot < owned ? "OWNED" : "WISH", 1500 + i * 31 + slot * 83);
            }
            if (i < 18) {
                long item = demoShelf(41, p, i < 8 ? "OWNED" : "WISH", 2000 + i * 193);
                if (i < 6) ensure("memo/" + p.externalId, "memos", "memo_id", row(
                        "user_perfume_id", item, "content", DemoContent.REVIEW_CONTEXT[i] + " " + DemoContent.REVIEW_END[i % 5],
                        "created_at", demoTime(8000 + i * 317), "updated_at", demoTime(8000 + i * 317)));
            }
            if (i < 6) demoShelf(42, p, i < 3 ? "OWNED" : "WISH", 2200 + i * 277);
            for (int v = 0; v < 2 + i * 7 % 29; v++) {
                int minute = 9000 + (i * 173 + v * 887) % 45000;
                int seconds = 12 + (i * 11 + v * 23) % 170;
                ensure("view/" + p.externalId + "/" + v, "user_perfume_views", "perfume_view_id", row(
                        "user_id", users[1 + (i * 3 + v * 7) % 40], "perfume_id", p.id,
                        "from_location_type", "SEARCH", "viewed_at", demoTime(minute),
                        "exited_at", demoBase.plusMinutes(minute).plusSeconds(seconds).toString(), "duration_seconds", seconds));
            }
            for (int n = 0; n < (i * 3 + 1) % 8; n++) {
                int author = 1 + (i * 13 + n * 7) % 40;
                int minute = 12000 + (i * 197 + n * 1709) % 36000;
                String key = "review/" + p.externalId + "/" + n;
                long review = number(ensure(key, "perfume_reviews", "id", row(
                        "user_id", users[author], "perfume_id", p.id,
                        "title", demoTitle(p.name + " · " + DemoContent.REVIEW_TITLES[(i + n) % 6], 100),
                        "content", DemoContent.REVIEW_CONTEXT[(i + n * 3) % 6] + " "
                                + DemoContent.REVIEW_FEELING[(i * 3 + n) % 7] + " " + DemoContent.REVIEW_END[(i + n) % 5],
                        "view_count", 3 + (i * 11 + n * 19) % 117,
                        "created_at", demoTime(minute), "updated_at", demoTime(minute))), "id");
                long season = number(query(db, "SELECT season_id FROM seasons WHERE code=?",
                        List.of("SPRING", "SUMMER", "AUTUMN", "WINTER").get((i + n) % 4)).getFirst(), "season_id");
                link(key + "/season", "perfume_review_seasons", "review_id", review, "season_id", season);
                for (int l = 0; l < (i + n) % 6; l++) link(key + "/like/" + l, "review_likes",
                        "review_id", review, "user_id", users[1 + (author + l * 7) % 40], "created_at", demoTime(minute + 37 + l * 79));
            }
        }
        for (int c = 0; c < 30; c++) {
            int owner = c < 3 ? 41 : 1 + (c * 7) % 40;
            DemoContent.Topic topic = DemoContent.TOPICS[c % 10];
            int minute = 15000 + c * 1103;
            int size = 3 + c % 3;
            List<Perfume> selected = new ArrayList<>();
            long collection = number(ensure("collection/" + c, "collections", "collection_id", row(
                    "user_id", users[owner], "name", topic.name(), "description", topic.description(),
                    "created_at", demoTime(minute), "updated_at", demoTime(minute))), "collection_id");
            for (int j = 0; j < size; j++) {
                Perfume p = perfumes.get(c < 3 ? c * 5 + j : (c * 17 + j * 3) % perfumes.size());
                selected.add(p);
                long shelf = demoShelf(owner, p, j % 3 == 0 ? "WISH" : "OWNED", 2500 + c * 179 + j * 31);
                link("collection/" + c + "/item/" + j, "collection_perfumes", "collection_id", collection,
                        "user_perfume_id", shelf, "display_order", j, "created_at", demoTime(minute));
            }
            for (int type = 0; type < 3; type++) {
                String category = List.of("COLLECTION", "RECOMMEND", "CHAT").get(type);
                long categoryId = number(query(db, "SELECT category_id FROM post_categories WHERE code=?", category).getFirst(), "category_id");
                int author = type == 0 ? owner : 1 + (c * 11 + type * 9) % 42;
                int posted = minute + 93 + type * 397;
                String key = "post/" + c + "/" + type;
                String title = switch (type) {
                    case 0 -> topic.name() + " — " + selected.getFirst().name() + " 외 " + (size - 1) + "개";
                    case 1 -> selected.getFirst().name() + " 시향 후보로 함께 봐주세요";
                    default -> List.of("", "문득 궁금해졌어요. ", "향수 고르다가 질문! ").get(c / 10) + topic.question();
                };
                String content = switch (type) {
                    case 0 -> topic.description() + "\n\n" + selected.stream().map(Perfume::name).collect(java.util.stream.Collectors.joining(", ")) + "를 담았어요. 아직 고민 중인 향도 있어 조금씩 바꿔 보려고 합니다.";
                    case 1 -> selected.getFirst().name() + "를 다음 시향 목록에 넣었습니다. " + topic.description() + "\n\n써보신 분들은 처음부터 마음에 드셨나요, 여러 번 써보면서 좋아지셨나요?";
                    default -> topic.discussion();
                };
                long post = number(ensure(key, "posts", "post_id", row(
                        "user_id", users[author], "category_id", categoryId, "title", demoTitle(title, 50), "content", content,
                        "collection_id", type == 0 ? collection : null, "collection_name", type == 0 ? topic.name() : null,
                        "view_count", 7 + (c * 47 + type * 31) % 283,
                        "created_at", demoTime(posted), "updated_at", demoTime(posted))), "post_id");
                for (int j = 0; j < (type == 0 ? size : type == 1 ? 1 : 0); j++) link(key + "/perfume/" + j,
                        "post_perfumes", "post_id", post, "perfume_id", selected.get(j).id, "display_order", j);
                for (int n = 0; n < (c * 3 + type) % 6; n++) {
                    String[] comments = type == 0
                            ? new String[]{"이렇게 상황별로 모아두니 고르기 좋겠어요.", "저도 샘플부터 하나씩 모아보는 중이에요.", selected.getFirst().name() + " 저도 시향 목록에 넣어둘게요.", "실제로 가장 자주 쓰시는 건 어떤 건가요?", "다 써보고 목록이 어떻게 바뀌었는지도 궁금해요."}
                            : type == 1 ? new String[]{"저는 바로 사기보다 다른 날 한 번 더 맡아보는 편이에요.", "매장에 가면 착향도 부탁해 보세요!", "샘플 다 써보고 결정하니까 후회가 덜했어요.", "저도 이 향 궁금해서 저장해 뒀어요.", "사용하고 나서 후기도 남겨주세요."}
                            : new String[]{"저도 비슷한 고민을 해봤어요. 그날 일정에 따라 달라지는 것 같아요.", "결국 조금씩 써보면서 제 기준을 찾게 되더라고요.", "다른 분들 이야기도 궁금해서 댓글 남기고 갑니다.", "취향이 바뀌는 과정도 기록해두면 재미있어요.", "처음부터 정답을 찾기보다는 천천히 시도해보려고요."};
                    ensure(key + "/comment/" + n, "comments", "comment_id", row(
                            "post_id", post, "user_id", users[1 + (author + n * 7) % 42], "content", comments[(c + n) % 5],
                            "created_at", demoTime(posted + 23 + n * 193), "updated_at", demoTime(posted + 23 + n * 193)));
                }
                for (int n = 0; n < (c * 7 + type * 3) % 13; n++) link(key + "/like/" + n, "post_likes",
                        "post_id", post, "user_id", users[1 + (author + n * 5) % 42], "created_at", demoTime(posted + 17 + n * 97));
            }
        }
    }

    private void verify() throws Exception {
        for (Perfume p : perfumes) {
            for (String status : List.of("OWNED", "WISH")) {
                if (count(db, "SELECT count(*) FROM user_perfumes WHERE perfume_id=? AND ownership_status=?", p.id, status) < 3)
                    throw new IllegalStateException("향수 순위 최소 인원이 모자랍니다.");
            }
            if (count(db, "SELECT count(*) FROM user_perfume_views WHERE perfume_id=?", p.id) < 1)
                throw new IllegalStateException("향수 조회 기록이 모자랍니다.");
        }
        if (count(db, "SELECT count(*) FROM collection_perfumes cp JOIN collections c USING(collection_id) "
                + "JOIN user_perfumes up ON up.user_perfumes_id=cp.user_perfume_id "
                + "WHERE c.user_id <> up.user_id") != 0) throw new IllegalStateException("컬렉션 소유권 불일치");
    }
}
