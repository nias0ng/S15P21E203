-- 향 지도 데이터 적재. 국내 대표 향수 200개의 좌표·향 계열·닮은 향수·향 특성을 넣습니다.
--
-- 실행 (이 디렉터리에서):
--     psql "$DATABASE_URL" -f load_scent_map.sql
--
-- \copy 가 상대 경로를 psql 의 현재 디렉터리에서 찾으므로 backend/db/seed 에서 실행해야 합니다.
-- 스키마는 V6 까지 적용돼 있어야 합니다.
--
-- 몇 번을 다시 돌려도 결과가 같습니다. 지도를 다시 만들면 향수 200개의 좌표와 계열이 통째로
-- 바뀌므로, 행을 하나씩 고치지 않고 이 향수들의 지도 데이터를 지운 뒤 다시 넣습니다.
-- 전체가 한 트랜잭션이라 중간에 하나라도 어긋나면 아무것도 반영되지 않습니다.

\set ON_ERROR_STOP on
\timing off

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. CSV 를 그대로 임시 테이블에 담습니다.
--
-- 전부 TEXT 로 받는 것은, 형 변환에서 실패하더라도 "CSV 읽기" 와 "값 넣기" 중 어디서 깨졌는지
-- 구분하기 위해서입니다. CSV 는 UTF-8(BOM) 이지만 HEADER true 가 첫 줄을 통째로 건너뛰므로
-- BOM 이 컬럼 이름에 섞이지 않습니다.
-- ---------------------------------------------------------------------------
CREATE TEMP TABLE stg_points (
    fragrantica_id TEXT, brand TEXT, name TEXT, year TEXT, gender TEXT,
    map_x TEXT, map_y TEXT, primary_family_key TEXT,
    korea_selection_rank TEXT, korea_selection_basis TEXT
) ON COMMIT DROP;

CREATE TEMP TABLE stg_families (
    fragrantica_id TEXT, family_key TEXT, weight TEXT, rank TEXT
) ON COMMIT DROP;

CREATE TEMP TABLE stg_neighbors (
    fragrantica_id TEXT, neighbor_fragrantica_id TEXT, similarity TEXT, rank TEXT
) ON COMMIT DROP;

CREATE TEMP TABLE stg_perfume_accords (
    fragrantica_id TEXT, accord_name TEXT, strength TEXT, rank TEXT
) ON COMMIT DROP;

CREATE TEMP TABLE stg_accords (
    accord_name TEXT
) ON COMMIT DROP;

CREATE TEMP TABLE stg_scent_families (
    family_key TEXT, name_ko TEXT, display_order TEXT, perfume_count TEXT,
    contributing_perfumes TEXT, area_share TEXT, largest_blob_share TEXT,
    weighted_coverage TEXT, anchor_x TEXT, anchor_y TEXT, polygon_json TEXT
) ON COMMIT DROP;

\copy stg_accords         FROM 'accords.csv'                  WITH (FORMAT csv, HEADER true, ENCODING 'UTF8')
\copy stg_scent_families  FROM 'scent_families.csv'           WITH (FORMAT csv, HEADER true, ENCODING 'UTF8')
\copy stg_points          FROM 'perfume_map_points.csv'       WITH (FORMAT csv, HEADER true, ENCODING 'UTF8')
\copy stg_families        FROM 'perfume_map_families.csv'     WITH (FORMAT csv, HEADER true, ENCODING 'UTF8')
\copy stg_neighbors       FROM 'perfume_map_neighbors.csv'    WITH (FORMAT csv, HEADER true, ENCODING 'UTF8')
\copy stg_perfume_accords FROM 'perfume_map_accords.csv'      WITH (FORMAT csv, HEADER true, ENCODING 'UTF8')

-- ---------------------------------------------------------------------------
-- 2. 향 특성(어코드) 이름.
--
-- 향수-어코드 행이 어코드를 이름으로 지목하므로 이름이 먼저 있어야 합니다. 이미 있는 이름은
-- 건드리지 않습니다. accord_id 가 바뀌면 그 어코드를 참조하던 다른 데이터가 어긋납니다.
-- ---------------------------------------------------------------------------
INSERT INTO accords (name)
SELECT accord_name FROM stg_accords
ON CONFLICT (name) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 3. 향 계열의 영역과 라벨 위치.
--
-- 계열 9개와 그 순서는 마이그레이션이 심어 둡니다. 여기서는 지도를 다시 만들 때마다 바뀌는
-- polygon 과 anchor 만 갱신합니다. code 로 찾으므로 scent_region_id 는 그대로 유지되고,
-- 이 번호를 참조하는 user_preference_regions 가 깨지지 않습니다.
-- ---------------------------------------------------------------------------
UPDATE scent_regions r
SET anchor_x = s.anchor_x::double precision,
    anchor_y = s.anchor_y::double precision,
    polygon  = s.polygon_json::jsonb
FROM stg_scent_families s
WHERE r.code = s.family_key;

-- ---------------------------------------------------------------------------
-- 4. 브랜드와 향수.
--
-- 향수는 fragrantica_id 로 다시 찾을 수 있어야 하므로, 이미 (브랜드, 이름) 으로 들어와 있는
-- 향수에는 그 값을 채워 넣고 없으면 새로 만듭니다.
-- description·concentration·name_ko 는 이 CSV 에 없으므로 건드리지 않습니다.
-- ---------------------------------------------------------------------------
INSERT INTO brands (name)
SELECT DISTINCT brand FROM stg_points
ON CONFLICT (name) DO NOTHING;

INSERT INTO perfumes (brand_id, name, gender, fragrantica_id, release_year,
                      korea_selection_rank, korea_selection_basis)
SELECT b.brand_id,
       s.name,
       s.gender,
       s.fragrantica_id::bigint,
       NULLIF(s.year, '')::int,
       s.korea_selection_rank::int,
       s.korea_selection_basis
FROM stg_points s
JOIN brands b ON b.name = s.brand
ON CONFLICT (brand_id, name) DO UPDATE SET
    gender                = EXCLUDED.gender,
    fragrantica_id        = EXCLUDED.fragrantica_id,
    release_year          = EXCLUDED.release_year,
    korea_selection_rank  = EXCLUDED.korea_selection_rank,
    korea_selection_basis = EXCLUDED.korea_selection_basis;

-- 이번에 적재하는 향수들입니다. 아래 삭제·삽입의 범위를 이 향수들로 한정해, 다른 경로로 들어온
-- 향수의 데이터를 건드리지 않습니다.
CREATE TEMP TABLE loaded_perfumes ON COMMIT DROP AS
SELECT p.perfume_id, p.fragrantica_id
FROM perfumes p
JOIN stg_points s ON s.fragrantica_id::bigint = p.fragrantica_id;

CREATE UNIQUE INDEX ON loaded_perfumes (fragrantica_id);

-- ---------------------------------------------------------------------------
-- 5. 지도 데이터를 비우고 다시 넣습니다.
--
-- 지도를 다시 만들면 좌표도 계열도 이웃도 전부 바뀝니다. 일부만 바뀌는 일이 없으므로 행 단위로
-- 맞춰 고치는 것보다 지우고 넣는 쪽이 단순하고 안전합니다.
-- ---------------------------------------------------------------------------
DELETE FROM perfume_map_points     WHERE perfume_id IN (SELECT perfume_id FROM loaded_perfumes);
DELETE FROM perfume_scent_families WHERE perfume_id IN (SELECT perfume_id FROM loaded_perfumes);
DELETE FROM perfume_neighbors      WHERE perfume_id IN (SELECT perfume_id FROM loaded_perfumes);
DELETE FROM perfume_accords        WHERE perfume_id IN (SELECT perfume_id FROM loaded_perfumes);

-- 5-1. 향수 좌표
INSERT INTO perfume_map_points (perfume_id, map_x, map_y)
SELECT l.perfume_id, s.map_x::double precision, s.map_y::double precision
FROM stg_points s
JOIN loaded_perfumes l ON l.fragrantica_id = s.fragrantica_id::bigint;

-- 5-2. 향수별 향 계열. 대표 계열은 비중이 가장 큰 행이므로 rank 는 넣지 않습니다.
INSERT INTO perfume_scent_families (perfume_id, scent_region_id, weight)
SELECT l.perfume_id, r.scent_region_id, s.weight::numeric
FROM stg_families s
JOIN loaded_perfumes l ON l.fragrantica_id = s.fragrantica_id::bigint
JOIN scent_regions r   ON r.code = s.family_key;

-- 5-3. 닮은 향수. 방향이 있는 관계라 한쪽 방향만 있는 행이 정상입니다.
INSERT INTO perfume_neighbors (perfume_id, neighbor_perfume_id, rank, similarity)
SELECT l.perfume_id, n.perfume_id, s.rank::int, s.similarity::numeric
FROM stg_neighbors s
JOIN loaded_perfumes l ON l.fragrantica_id = s.fragrantica_id::bigint
JOIN loaded_perfumes n ON n.fragrantica_id = s.neighbor_fragrantica_id::bigint;

-- 5-4. 향 특성. CSV 의 strength 는 0~100 이고 perfume_accords.weight 는 0~1 이라 100 으로 나눕니다.
INSERT INTO perfume_accords (perfume_id, accord_id, rank, weight)
SELECT l.perfume_id, a.accord_id, s.rank::int, s.strength::numeric / 100
FROM stg_perfume_accords s
JOIN loaded_perfumes l ON l.fragrantica_id = s.fragrantica_id::bigint
JOIN accords a         ON a.name = s.accord_name;

-- ---------------------------------------------------------------------------
-- 6. 검증.
--
-- 조인이 안 맞으면 INSERT 는 오류 없이 행을 적게 넣고 끝납니다. 그게 가장 위험한 실패라서,
-- CSV 의 행 수와 실제로 들어간 행 수를 직접 비교하고 하나라도 다르면 전체를 되돌립니다.
-- ---------------------------------------------------------------------------
DO $$
DECLARE
    unresolved BIGINT;
    expected   BIGINT;
    actual     BIGINT;
BEGIN
    -- 6-1. CSV 가 지목한 것을 전부 찾았는가
    SELECT count(*) INTO unresolved
    FROM stg_points s LEFT JOIN loaded_perfumes l ON l.fragrantica_id = s.fragrantica_id::bigint
    WHERE l.perfume_id IS NULL;
    IF unresolved > 0 THEN
        RAISE EXCEPTION 'perfumes 로 이어지지 않은 향수 %건', unresolved;
    END IF;

    SELECT count(DISTINCT s.family_key) INTO unresolved
    FROM stg_families s LEFT JOIN scent_regions r ON r.code = s.family_key
    WHERE r.scent_region_id IS NULL;
    IF unresolved > 0 THEN
        RAISE EXCEPTION 'scent_regions.code 와 맞지 않는 family_key %종', unresolved;
    END IF;

    SELECT count(DISTINCT s.accord_name) INTO unresolved
    FROM stg_perfume_accords s LEFT JOIN accords a ON a.name = s.accord_name
    WHERE a.accord_id IS NULL;
    IF unresolved > 0 THEN
        RAISE EXCEPTION 'accords.name 과 맞지 않는 어코드 %종', unresolved;
    END IF;

    SELECT count(*) INTO unresolved
    FROM stg_neighbors s
    LEFT JOIN loaded_perfumes n ON n.fragrantica_id = s.neighbor_fragrantica_id::bigint
    WHERE n.perfume_id IS NULL;
    IF unresolved > 0 THEN
        RAISE EXCEPTION '적재 대상 밖을 가리키는 닮은 향수 %건', unresolved;
    END IF;

    -- 6-2. CSV 행 수만큼 들어갔는가
    SELECT count(*) INTO expected FROM stg_points;
    SELECT count(*) INTO actual FROM perfume_map_points
        WHERE perfume_id IN (SELECT perfume_id FROM loaded_perfumes);
    IF expected <> actual THEN
        RAISE EXCEPTION 'perfume_map_points 기대 %행, 실제 %행', expected, actual;
    END IF;

    SELECT count(*) INTO expected FROM stg_families;
    SELECT count(*) INTO actual FROM perfume_scent_families
        WHERE perfume_id IN (SELECT perfume_id FROM loaded_perfumes);
    IF expected <> actual THEN
        RAISE EXCEPTION 'perfume_scent_families 기대 %행, 실제 %행', expected, actual;
    END IF;

    SELECT count(*) INTO expected FROM stg_neighbors;
    SELECT count(*) INTO actual FROM perfume_neighbors
        WHERE perfume_id IN (SELECT perfume_id FROM loaded_perfumes);
    IF expected <> actual THEN
        RAISE EXCEPTION 'perfume_neighbors 기대 %행, 실제 %행', expected, actual;
    END IF;

    SELECT count(*) INTO expected FROM stg_perfume_accords;
    SELECT count(*) INTO actual FROM perfume_accords
        WHERE perfume_id IN (SELECT perfume_id FROM loaded_perfumes);
    IF expected <> actual THEN
        RAISE EXCEPTION 'perfume_accords 기대 %행, 실제 %행', expected, actual;
    END IF;

    -- 6-3. 계열 9개가 영역을 받았는가
    SELECT count(*) INTO unresolved
    FROM stg_scent_families s JOIN scent_regions r ON r.code = s.family_key
    WHERE r.polygon IS NULL OR r.anchor_x IS NULL OR r.anchor_y IS NULL;
    IF unresolved > 0 THEN
        RAISE EXCEPTION '영역이나 라벨 위치가 비어 있는 계열 %개', unresolved;
    END IF;

    -- 6-4. 비중이 가장 큰 계열이 CSV 의 대표 계열과 같은가.
    -- 대표를 따로 저장하지 않고 비중으로 유도하기로 한 근거라, 적재할 때마다 확인합니다.
    SELECT count(*) INTO unresolved
    FROM (
        SELECT DISTINCT ON (f.perfume_id) f.perfume_id, r.code
        FROM perfume_scent_families f
        JOIN scent_regions r ON r.scent_region_id = f.scent_region_id
        WHERE f.perfume_id IN (SELECT perfume_id FROM loaded_perfumes)
        ORDER BY f.perfume_id, f.weight DESC, r.scent_region_id
    ) d
    JOIN loaded_perfumes l ON l.perfume_id = d.perfume_id
    JOIN stg_points s ON s.fragrantica_id::bigint = l.fragrantica_id
    WHERE d.code <> s.primary_family_key;
    IF unresolved > 0 THEN
        RAISE EXCEPTION '비중 1위 계열이 CSV 의 primary_family_key 와 다른 향수 %건', unresolved;
    END IF;
END $$;

COMMIT;

\echo ''
\echo '=== 적재 결과 ==='
SELECT (SELECT count(*) FROM perfumes WHERE fragrantica_id IS NOT NULL) AS perfumes,
       (SELECT count(*) FROM perfume_map_points)                        AS map_points,
       (SELECT count(*) FROM perfume_scent_families)                    AS scent_families,
       (SELECT count(*) FROM perfume_neighbors)                         AS neighbors,
       (SELECT count(*) FROM perfume_accords)                           AS perfume_accords,
       (SELECT count(*) FROM accords)                                   AS accords,
       (SELECT count(*) FROM scent_regions WHERE polygon IS NOT NULL)   AS regions_with_polygon;
