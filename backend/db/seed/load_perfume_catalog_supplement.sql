-- 주 카탈로그 생성 과정에서 accord가 없어 제외됐지만, 노트 연결이 존재하는 향수 152개를
-- 보충합니다. 추천용 accord와 평가자 수는 원본에 없으므로 만들지 않으며, 검색·상세·노트 조회에
-- 필요한 향수 식별 정보만 넣습니다.

\set ON_ERROR_STOP on
\pset pager off
\timing off

BEGIN;

CREATE TEMP TABLE stg_perfume_catalog_supplement (
    fragrantica_id TEXT,
    name TEXT,
    name_ko TEXT,
    brand_name TEXT,
    brand_name_ko TEXT,
    note_link_count TEXT
) ON COMMIT DROP;

\copy stg_perfume_catalog_supplement FROM 'perfume_catalog_supplement.csv' WITH (FORMAT csv, HEADER true, ENCODING 'UTF8')

DO $$
DECLARE
    row_count bigint := (SELECT count(*) FROM stg_perfume_catalog_supplement);
    distinct_ids bigint := (
        SELECT count(DISTINCT fragrantica_id) FROM stg_perfume_catalog_supplement
    );
    note_links bigint := (
        SELECT sum(note_link_count::bigint) FROM stg_perfume_catalog_supplement
    );
    invalid_rows bigint := (
        SELECT count(*)
        FROM stg_perfume_catalog_supplement
        WHERE fragrantica_id !~ '^[1-9][0-9]*$'
           OR NULLIF(btrim(name), '') IS NULL
           OR NULLIF(btrim(brand_name), '') IS NULL
           OR note_link_count !~ '^[1-9][0-9]*$'
    );
BEGIN
    IF row_count <> 152 OR distinct_ids <> 152 THEN
        RAISE EXCEPTION '보충 향수 수가 다릅니다: 행 %, 고유 ID % (기대 152)',
            row_count, distinct_ids;
    END IF;
    IF note_links <> 591 THEN
        RAISE EXCEPTION '보충 향수의 노트 연결 수가 다릅니다: 기대 591, 실제 %', note_links;
    END IF;
    IF invalid_rows <> 0 THEN
        RAISE EXCEPTION '필수값이나 숫자 형식이 잘못된 보충 향수가 %개입니다', invalid_rows;
    END IF;
END $$;

-- 기존 카탈로그에 없는 브랜드 5개도 여기서 생성합니다. 나머지 브랜드는 이름으로 재사용합니다.
INSERT INTO brands (name)
SELECT DISTINCT btrim(brand_name)
FROM stg_perfume_catalog_supplement
ON CONFLICT (name) DO NOTHING;

WITH brand_meta AS (
    SELECT btrim(brand_name) AS name,
           min(NULLIF(btrim(brand_name_ko), '')) AS name_ko
    FROM stg_perfume_catalog_supplement
    GROUP BY btrim(brand_name)
    HAVING count(DISTINCT NULLIF(btrim(brand_name_ko), '')) <= 1
)
UPDATE brands b
SET name_ko = COALESCE(m.name_ko, b.name_ko)
FROM brand_meta m
WHERE b.name = m.name
  AND m.name_ko IS NOT NULL;

-- 평가자 수는 알 수 없으므로 새 행의 기본값 0을 사용합니다. 재실행 시 운영자가 내린 is_active와
-- 나중에 보강한 평가자 수는 유지하고, 식별·표시 정보만 갱신합니다.
INSERT INTO perfumes AS target (fragrantica_id, name, name_ko, brand_id)
SELECT s.fragrantica_id::bigint,
       btrim(s.name),
       NULLIF(btrim(s.name_ko), ''),
       b.brand_id
FROM stg_perfume_catalog_supplement s
JOIN brands b ON b.name = btrim(s.brand_name)
ON CONFLICT (fragrantica_id) DO UPDATE SET
    name    = EXCLUDED.name,
    name_ko = COALESCE(EXCLUDED.name_ko, target.name_ko),
    brand_id = EXCLUDED.brand_id;

DO $$
DECLARE
    loaded bigint := (
        SELECT count(*)
        FROM stg_perfume_catalog_supplement s
        JOIN perfumes p ON p.fragrantica_id = s.fragrantica_id::bigint
        JOIN brands b ON b.brand_id = p.brand_id AND b.name = btrim(s.brand_name)
        WHERE p.name = btrim(s.name)
          AND p.name_ko IS NOT DISTINCT FROM NULLIF(btrim(s.name_ko), '')
    );
BEGIN
    IF loaded <> 152 THEN
        RAISE EXCEPTION '보충 향수 반영이 모자랍니다: 기대 152, 실제 %', loaded;
    END IF;
END $$;

SELECT count(*) AS supplemental_perfumes,
       count(DISTINCT brand_name) AS referenced_brands,
       sum(note_link_count::bigint) AS pending_note_links
FROM stg_perfume_catalog_supplement;

COMMIT;

ANALYZE brands;
ANALYZE perfumes;
