-- 향수 gender 보강 seed.
-- perfumes_missing_gender.csv에서 제공된 성별을 fragrantica_id로 맞춰 빈 값에만 채웁니다.
-- 이름·브랜드·ID가 어긋나거나 기존 값과 충돌하면 전체 트랜잭션을 중단합니다.

\set ON_ERROR_STOP on
\pset pager off
\timing on

BEGIN;

CREATE TEMP TABLE stg_perfume_genders (
    fragrantica_id TEXT,
    name TEXT,
    brand_name TEXT,
    gender TEXT
) ON COMMIT DROP;

\copy stg_perfume_genders FROM 'perfume_genders.csv' WITH (FORMAT csv, HEADER true, ENCODING 'UTF8')

DO $$
DECLARE
    row_count BIGINT := (SELECT count(*) FROM stg_perfume_genders);
    distinct_id_count BIGINT := (SELECT count(DISTINCT fragrantica_id) FROM stg_perfume_genders);
    invalid_count BIGINT := (
        SELECT count(*)
        FROM stg_perfume_genders
        WHERE fragrantica_id !~ '^[1-9][0-9]*$'
           OR NULLIF(btrim(name), '') IS NULL
           OR NULLIF(btrim(brand_name), '') IS NULL
           OR lower(btrim(gender)) NOT IN ('female', 'male', 'unisex')
    );
BEGIN
    IF row_count <> 129113 OR distinct_id_count <> 129113 THEN
        RAISE EXCEPTION 'gender CSV 수가 다릅니다: 행 %, 고유 ID % (기대 129113)',
            row_count, distinct_id_count;
    END IF;
    IF invalid_count <> 0 THEN
        RAISE EXCEPTION 'gender CSV의 필수값 또는 성별 어휘가 잘못된 행이 %개입니다', invalid_count;
    END IF;
END $$;

DO $$
DECLARE
    missing_catalog_count BIGINT := (
        SELECT count(*)
        FROM stg_perfume_genders s
        LEFT JOIN perfumes p ON p.fragrantica_id = s.fragrantica_id::bigint
        WHERE p.perfume_id IS NULL
    );
    name_brand_mismatch_count BIGINT := (
        SELECT count(*)
        FROM stg_perfume_genders s
        JOIN perfumes p ON p.fragrantica_id = s.fragrantica_id::bigint
        LEFT JOIN brands b ON b.brand_id = p.brand_id
        WHERE p.name IS DISTINCT FROM s.name
           OR b.name IS DISTINCT FROM s.brand_name
    );
    existing_gender_conflict_count BIGINT := (
        SELECT count(*)
        FROM stg_perfume_genders s
        JOIN perfumes p ON p.fragrantica_id = s.fragrantica_id::bigint
        WHERE NULLIF(btrim(p.gender), '') IS NOT NULL
          AND upper(btrim(p.gender)) <> upper(btrim(s.gender))
    );
BEGIN
    IF missing_catalog_count <> 0 THEN
        RAISE EXCEPTION '카탈로그에 없는 fragrantica_id가 %개입니다', missing_catalog_count;
    END IF;
    IF name_brand_mismatch_count <> 0 THEN
        RAISE EXCEPTION '향수 이름 또는 브랜드가 원본과 다른 행이 %개입니다', name_brand_mismatch_count;
    END IF;
    IF existing_gender_conflict_count <> 0 THEN
        RAISE EXCEPTION '기존 gender와 충돌하는 행이 %개입니다', existing_gender_conflict_count;
    END IF;
END $$;

UPDATE perfumes AS p
SET gender = upper(btrim(s.gender))
FROM stg_perfume_genders AS s
WHERE p.fragrantica_id = s.fragrantica_id::bigint
  AND NULLIF(btrim(p.gender), '') IS NULL;

DO $$
DECLARE
    incomplete_count BIGINT := (
        SELECT count(*)
        FROM stg_perfume_genders s
        JOIN perfumes p ON p.fragrantica_id = s.fragrantica_id::bigint
        WHERE upper(btrim(p.gender)) <> upper(btrim(s.gender))
    );
BEGIN
    IF incomplete_count <> 0 THEN
        RAISE EXCEPTION 'gender 반영 결과가 원본과 다른 행이 %개입니다', incomplete_count;
    END IF;
END $$;

SELECT upper(btrim(gender)) AS gender, count(*) AS perfumes
FROM stg_perfume_genders
GROUP BY upper(btrim(gender))
ORDER BY gender;

COMMIT;

ANALYZE perfumes;
