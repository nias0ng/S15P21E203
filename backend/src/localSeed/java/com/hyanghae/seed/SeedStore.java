package com.hyanghae.seed;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.sql.Connection;
import java.sql.SQLException;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

/** 생성한 행의 키와 최초 값을 기록합니다. 사람이 만든 행을 소유 데이터로 편입하지 않습니다. */
final class SeedStore {
    private static final ObjectMapper JSON = new ObjectMapper();
    private final Connection db;
    private final boolean reset;
    private final String registrySchema;
    private final Map<String, Map<String, Object>> registry = new java.util.HashMap<>();
    int inserted;
    int restored;

    SeedStore(Connection db, boolean reset, String registrySchema) throws SQLException {
        if (!Set.of("local_seed", "demo_seed").contains(registrySchema)) {
            throw new IllegalArgumentException("허용되지 않은 seed 장부 스키마입니다.");
        }
        this.db = db;
        this.reset = reset;
        this.registrySchema = registrySchema;
        for (var record : query(db, "SELECT seed_key, table_name, primary_key::text AS pk, baseline::text AS baseline FROM "
                + registrySchema + ".records")) {
            registry.put(record.get("seed_key").toString(), record);
        }
    }

    boolean contains(String key) { return registry.containsKey(key); }

    Map<String, Object> ensure(String key, String table, List<String> pk, Map<String, Object> values)
            throws Exception {
        if (registry.containsKey(key)) {
            Map<String, Object> record = registry.get(key);
            if (!table.equals(record.get("table_name"))) {
                throw new IllegalStateException("seed 키의 테이블이 바뀌었습니다: " + key);
            }
            Map<String, Object> baseline = parse(record.get("baseline").toString());
            Map<String, Object> primaryKey = parse(record.get("pk").toString());
            String where = pk.stream().map(c -> "t." + c + " = ?").collect(Collectors.joining(" AND "));
            List<Map<String, Object>> found = query(db,
                    "SELECT * FROM public." + table + " t WHERE " + where,
                    pk.stream().map(primaryKey::get).toArray());
            if (!found.isEmpty()) {
                if (reset) {
                    String assignments = baseline.keySet().stream().filter(c -> !pk.contains(c))
                            .map(c -> c + " = src." + c).collect(Collectors.joining(", "));
                    if (!assignments.isEmpty()) {
                        execute(db, "UPDATE public." + table + " t SET " + assignments
                                + " FROM jsonb_populate_record(NULL::public." + table
                                + ", ?::jsonb) src WHERE "
                                + pk.stream().map(c -> "t." + c + " = src." + c).collect(Collectors.joining(" AND ")),
                                json(baseline));
                    }
                    restored++;
                }
                return reset ? baseline : found.getFirst();
            }
            // 삭제된 seed 행은 같은 PK로 복원합니다. 새 수동 행과 UNIQUE가 충돌하면 전체 롤백합니다.
            insert(table, baseline);
            inserted++;
            return baseline;
        }
        Map<String, Object> created = insert(table, values);
        Map<String, Object> primaryKey = new LinkedHashMap<>();
        pk.forEach(column -> primaryKey.put(column, created.get(column)));
        execute(db, "INSERT INTO " + registrySchema + ".records VALUES (?, ?, ?::jsonb, ?::jsonb)",
                key, table, json(primaryKey), json(created));
        registry.put(key, row("table_name", table, "pk", json(primaryKey), "baseline", json(created)));
        inserted++;
        return created;
    }

    private Map<String, Object> insert(String table, Map<String, Object> data) throws Exception {
        String columns = String.join(", ", data.keySet());
        // 식별자는 코드 내부의 테이블/컬럼명만 사용합니다. 값은 항상 바인딩합니다.
        return parse(query(db, "INSERT INTO public." + table + " AS t (" + columns + ") SELECT "
                + columns + " FROM jsonb_populate_record(NULL::public." + table
                + ", ?::jsonb) RETURNING to_jsonb(t)::text AS row", json(data))
                .getFirst().get("row").toString());
    }

    static Map<String, Object> row(Object... pairs) {
        Map<String, Object> result = new LinkedHashMap<>();
        for (int i = 0; i < pairs.length; i += 2) result.put((String) pairs[i], pairs[i + 1]);
        return result;
    }

    static long number(Map<String, Object> row, String key) {
        return ((Number) row.get(key)).longValue();
    }

    static List<Map<String, Object>> query(Connection db, String sql, Object... args) throws SQLException {
        try (var statement = db.prepareStatement(sql)) {
            for (int i = 0; i < args.length; i++) statement.setObject(i + 1, args[i]);
            try (var rs = statement.executeQuery()) {
                var rows = new java.util.ArrayList<Map<String, Object>>();
                while (rs.next()) {
                    Map<String, Object> row = new LinkedHashMap<>();
                    for (int c = 1; c <= rs.getMetaData().getColumnCount(); c++) {
                        row.put(rs.getMetaData().getColumnLabel(c), rs.getObject(c));
                    }
                    rows.add(row);
                }
                return rows;
            }
        }
    }

    static void execute(Connection db, String sql, Object... args) throws SQLException {
        try (var statement = db.prepareStatement(sql)) {
            for (int i = 0; i < args.length; i++) statement.setObject(i + 1, args[i]);
            statement.execute();
        }
    }

    static long count(Connection db, String sql, Object... args) throws SQLException {
        return ((Number) query(db, sql, args).getFirst().values().iterator().next()).longValue();
    }

    private static String json(Object value) throws Exception {
        return JSON.writeValueAsString(value);
    }

    private static Map<String, Object> parse(String value) throws Exception {
        return JSON.readValue(value, new TypeReference<LinkedHashMap<String, Object>>() {});
    }
}
