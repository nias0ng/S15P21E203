-- 향수 카탈로그 적재. 자연어 추천이 쓰는 향수 129,161개와 향 특성 100만 행을 넣고
-- perfume_ko.csv의 한국어 이름을 보충합니다.
--
-- 실행 (이 디렉터리에서):
--     ./load_perfume_catalog.sh
--
-- gzip 을 푸는 일이 있어 셸 스크립트를 함께 둡니다. psql 만으로 돌리려면 먼저 두 파일을 풀고
--     psql "$DATABASE_URL" -f load_perfume_catalog.sql
-- 로 실행하십시오. \copy 가 상대 경로를 psql 의 현재 디렉터리에서 찾으므로 이 디렉터리에서
-- 실행해야 합니다.
--
-- 스키마는 V14 까지 적용돼 있어야 합니다. V14 가 uk_perfumes_brand_name 을 걷어내고
-- fragrantica_rating_count 를 만듭니다. 그 전에 돌리면 5번에서 다음처럼 멈춥니다.
--
--     ERROR: column "fragrantica_rating_count" of relation "perfumes" does not exist
--
-- 컬럼이 먼저 걸려서 유니크 제약까지 가지도 못합니다. 제약만 남아 있었다면 이름이 겹치는
-- 1,360행에서 멈췄을 것입니다.
--
-- 몇 번을 다시 돌려도 결과가 같습니다. 향수는 fragrantica_id 로 맞춰 없으면 넣고 있으면
-- 갱신하며, 향 특성은 이번에 적재하는 향수의 것만 지우고 다시 넣습니다. 전체가 한 트랜잭션이라
-- 중간에 하나라도 어긋나면 아무것도 반영되지 않습니다.
--
-- 향 지도 적재(load_scent_map.sql)와 함께 쓸 수 있습니다. 어느 쪽을 먼저 돌려도 됩니다.
-- 향 지도용 200개가 이 데이터에도 들어 있고, 양쪽 다 fragrantica_id 로 맞추기 때문입니다.

\set ON_ERROR_STOP on
\pset pager off
\timing on

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. CSV 를 그대로 임시 테이블에 담습니다.
--
-- 전부 TEXT 로 받는 것은 향 지도 적재와 같은 이유입니다. 형 변환에서 실패하더라도 "CSV 읽기" 와
-- "값 넣기" 중 어디서 깨졌는지 구분할 수 있습니다.
-- ---------------------------------------------------------------------------
CREATE TEMP TABLE stg_brands (
    name TEXT
) ON COMMIT DROP;

CREATE TEMP TABLE stg_brands_ko (
    name TEXT,
    name_ko TEXT,
    note TEXT,
    logo_domain TEXT,
    n_perfumes TEXT,
    logo_override TEXT
) ON COMMIT DROP;

CREATE TEMP TABLE stg_accords (
    name TEXT, is_new TEXT
) ON COMMIT DROP;

CREATE TEMP TABLE stg_perfumes (
    fragrantica_id TEXT, name TEXT, brand_name TEXT, people TEXT, already_in_db TEXT
) ON COMMIT DROP;

CREATE TEMP TABLE stg_perfume_accords (
    fragrantica_id TEXT, accord_name TEXT, rank TEXT, weight TEXT
) ON COMMIT DROP;

CREATE TEMP TABLE stg_perfume_ko (
    name TEXT, translated_name TEXT
) ON COMMIT DROP;

-- 다섯 파일을 psql 의 현재 디렉터리에서 읽습니다. ai/delivery/for_db 에서 바로 읽지 않는 이유는
-- 둘이 gzip 이고 \copy 가 압축을 풀지 못하기 때문입니다. load_perfume_catalog.sh 가 다섯 파일을
-- 한곳에 모아 두고 이 스크립트를 부릅니다.
\copy stg_brands          FROM 'brands.csv'          WITH (FORMAT csv, HEADER true)
\copy stg_brands_ko       FROM 'brands_ko.csv'       WITH (FORMAT csv, HEADER true)
\copy stg_accords         FROM 'accords.csv'         WITH (FORMAT csv, HEADER true)
\copy stg_perfumes        FROM 'perfumes.csv'        WITH (FORMAT csv, HEADER true)
\copy stg_perfume_accords FROM 'perfume_accords.csv' WITH (FORMAT csv, HEADER true)
\copy stg_perfume_ko      FROM 'perfume_ko.csv'      WITH (FORMAT csv, HEADER true)

-- ---------------------------------------------------------------------------
-- 2. 넘겨받은 수가 맞는지 먼저 봅니다.
--
-- 여기서 걸리면 CSV 가 잘렸거나 다른 파일을 읽은 것입니다. 뒤에서 외래키나 제약으로 터지면
-- 원인을 찾기 어려우므로 앞에서 막습니다. 숫자는 인계 문서(ai/docs/perfume_load_handoff.md)가
-- 실제 데이터를 세어 적은 값입니다.
-- ---------------------------------------------------------------------------
DO $$
DECLARE
    brand_count   bigint := (SELECT count(*) FROM stg_brands);
    accord_count  bigint := (SELECT count(*) FROM stg_accords);
    perfume_count bigint := (SELECT count(*) FROM stg_perfumes);
    pa_count      bigint := (SELECT count(*) FROM stg_perfume_accords);
BEGIN
    IF brand_count <> 7793 THEN
        RAISE EXCEPTION '브랜드 수가 다릅니다: 기대 7793, 실제 %', brand_count;
    END IF;
    IF accord_count <> 92 THEN
        RAISE EXCEPTION 'accord 수가 다릅니다: 기대 92, 실제 %', accord_count;
    END IF;
    IF perfume_count <> 129161 THEN
        RAISE EXCEPTION '향수 수가 다릅니다: 기대 129161, 실제 %', perfume_count;
    END IF;
    IF pa_count <> 1000570 THEN
        RAISE EXCEPTION '향 특성 수가 다릅니다: 기대 1000570, 실제 %', pa_count;
    END IF;
END $$;

-- 영문 이름 하나에 번역이 하나로 정해지는 값만 미리 모읍니다. 이 임시 표를 분석해 두면
-- 13만 건을 이름으로 맞출 때 PostgreSQL이 전체 표를 반복해서 훑지 않습니다.
CREATE TEMP TABLE stg_perfume_ko_unique ON COMMIT DROP AS
SELECT name, min(NULLIF(btrim(translated_name), '')) AS translated_name
FROM stg_perfume_ko
WHERE NULLIF(btrim(name), '') IS NOT NULL
  AND NULLIF(btrim(translated_name), '') IS NOT NULL
GROUP BY name
HAVING count(DISTINCT btrim(translated_name)) = 1;

CREATE UNIQUE INDEX ON stg_perfume_ko_unique (name);
ANALYZE stg_perfumes;
ANALYZE stg_perfume_ko_unique;

-- ---------------------------------------------------------------------------
-- 3. 브랜드. 이름으로 맞춰 없는 것만 넣습니다.
--
-- 향 지도 때 넣은 브랜드가 여기에도 있습니다. 같은 브랜드를 두 번 만들면 향수가 갈립니다.
-- uk_brands_name 이 있어 ON CONFLICT 로 넘길 수 있습니다.
--
-- 앞뒤 공백은 AI 쪽 생성기가 이미 털었습니다. SQL 의 TRIM() 은 NBSP(U+00A0)를 걷지 못해
-- 여기서 다시 하면 오히려 걷히지 않은 것을 걷힌 것으로 착각하게 됩니다.
-- ---------------------------------------------------------------------------
INSERT INTO brands (name)
SELECT name FROM stg_brands
ON CONFLICT (name) DO NOTHING;

-- 브랜드 한국어 이름과 로고를 보충합니다. 같은 영문 이름에 번역이 여러 개인 경우에는
-- 한국어 이름만 건너뛰고, 로고 정보는 사용할 수 있으면 별도로 반영합니다.
-- logo_override가 있으면 그대로 쓰고, 없으면 logo_domain으로 img.logo.dev 주소를 만듭니다.
--
-- 서로 다른 브랜드가 같은 한국어 이름을 쓰는 것은 막지 않습니다. 리들(Lidl / Riddle),
-- 노이즈(Noyz / Noise) 처럼 실제로 다른 브랜드라 합칠 수 없고, 화면은 카드 부제의 영문명으로
-- 둘을 구분합니다. 예전에는 brands.name_ko 의 UNIQUE 제약에 걸리지 않으려고 중복 한글명을
-- 여기서 건너뛰었는데, 그 탓에 해당 브랜드의 한국어 이름이 영구히 비어 있었습니다.
-- 제약은 V21 에서 뗐습니다.
--
-- count(DISTINCT name_ko) = 1 은 남겨 둡니다. 그것은 "같은 영문 브랜드에 번역이 둘"인 별개
-- 상황을 막는 장치라 위 변경과 무관합니다. 어느 쪽이 맞는지 CSV 만 보고는 알 수 없습니다.
WITH brand_meta AS (
    SELECT name,
           CASE WHEN count(DISTINCT NULLIF(btrim(name_ko), '')) = 1
                THEN min(NULLIF(btrim(name_ko), '')) END AS name_ko,
           max(NULLIF(btrim(logo_domain), '')) AS logo_domain,
           max(NULLIF(btrim(logo_override), '')) AS logo_override
    FROM stg_brands_ko
    WHERE NULLIF(btrim(name), '') IS NOT NULL
    GROUP BY name
)
UPDATE brands b
SET name_ko = COALESCE(NULLIF(btrim(b.name_ko), ''), m.name_ko),
    logo_url = COALESCE(
        m.logo_override,
        NULLIF(btrim(b.logo_url), ''),
        CASE WHEN m.logo_domain IS NOT NULL
             THEN 'https://img.logo.dev/' || m.logo_domain END
    )
FROM brand_meta m
WHERE b.name = m.name
  AND (m.name_ko IS NOT NULL OR m.logo_override IS NOT NULL OR m.logo_domain IS NOT NULL);

-- ---------------------------------------------------------------------------
-- 4. accord 마스터. 92개 중 없는 것만 들어갑니다.
--
-- is_new 열을 보지 않고 ON CONFLICT 로 넘깁니다. 그 열은 AI 가 센 결과이고, 실제로 무엇이
-- 없는지는 DB 가 압니다. 두 값이 어긋나도 결과가 달라지지 않는 쪽을 씁니다.
-- ---------------------------------------------------------------------------
INSERT INTO accords (name)
SELECT name FROM stg_accords
ON CONFLICT (name) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 5. 향수. fragrantica_id 로 맞춰 없으면 넣고 있으면 갱신합니다.
--
-- 향 지도용 200개가 이 데이터에 전부 들어 있습니다. 그냥 넣으면 같은 향수가 두 번 생겨
-- 지도가 가리키는 향수와 추천이 가리키는 향수가 갈립니다.
--
-- 갱신할 때 이름과 브랜드도 바꿉니다. 이름이 열쇠가 아니므로 원본에서 이름이 바뀌어도 같은
-- 행을 따라갑니다. 반대로 gender·description 처럼 원본 CSV 에 없는 값은 건드리지 않습니다.
-- name_ko 는 별도 한국어 이름 CSV로 빈 값만 보충합니다.
--
-- is_active 도 건드리지 않습니다. 운영에서 내린 향수를 적재가 되살리면 안 됩니다.
--
-- fragrantica_id 가 비어 있는 향수는 짝지을 수 없어 그대로 남습니다. NULL 은 무엇과도 같지
-- 않기 때문입니다. 손으로 넣어 둔 향수가 카탈로그에도 있으면 같은 이름이 두 줄이 됩니다.
-- 적재가 만든 중복이 아니라 원래 있던 행이고, 어느 쪽이 진짜인지는 사람이 정해야 합니다.
-- 운영에 적재하기 전에 SELECT * FROM perfumes WHERE fragrantica_id IS NULL 로 확인하십시오.
-- ---------------------------------------------------------------------------
INSERT INTO perfumes AS target (fragrantica_id, name, name_ko, brand_id, fragrantica_rating_count)
SELECT s.fragrantica_id::bigint,
       s.name,
       ko.translated_name,
       b.brand_id,
       s.people::int
FROM stg_perfumes s
JOIN brands b ON b.name = s.brand_name
LEFT JOIN stg_perfume_ko_unique ko ON ko.name = s.name
ON CONFLICT (fragrantica_id) DO UPDATE SET
    name                     = EXCLUDED.name,
    name_ko                  = COALESCE(NULLIF(btrim(target.name_ko), ''), EXCLUDED.name_ko),
    brand_id                 = EXCLUDED.brand_id,
    fragrantica_rating_count = EXCLUDED.fragrantica_rating_count;

-- ---------------------------------------------------------------------------
-- 6. 향 특성 100만 행.
--
-- 이번에 적재하는 향수의 것만 지우고 다시 넣습니다. 다른 경로로 들어온 향수의 향 특성은
-- 건드리지 않습니다. 향 지도 적재가 같은 방식을 씁니다.
--
-- weight 를 100 으로 나눕니다. CSV 의 세기는 1~100 이고 perfume_accords.weight 는
-- ck_perfume_accords_weight 가 0 < weight <= 1 로 막고 있습니다. 인계 문서는 "세기 그대로"
-- 라고 적었지만 표가 받는 범위가 다릅니다. 향 지도 적재도 같은 자리에서 나눕니다.
--
-- rank 는 그대로 씁니다. 원본이 세기 내림차순으로 정렬돼 있어 순서가 곧 순위입니다.
-- ---------------------------------------------------------------------------
CREATE TEMP TABLE loaded_perfumes ON COMMIT DROP AS
SELECT p.perfume_id, p.fragrantica_id
FROM perfumes p
JOIN stg_perfumes s ON s.fragrantica_id::bigint = p.fragrantica_id;

CREATE UNIQUE INDEX ON loaded_perfumes (fragrantica_id);

DELETE FROM perfume_accords
WHERE perfume_id IN (SELECT perfume_id FROM loaded_perfumes);

INSERT INTO perfume_accords (perfume_id, accord_id, rank, weight)
SELECT l.perfume_id,
       a.accord_id,
       s.rank::int,
       s.weight::numeric / 100
FROM stg_perfume_accords s
JOIN loaded_perfumes l ON l.fragrantica_id = s.fragrantica_id::bigint
JOIN accords a ON a.name = s.accord_name;

-- ---------------------------------------------------------------------------
-- 7. 넣은 결과를 다시 셉니다.
--
-- 조인이 조용히 행을 떨어뜨렸는지 여기서 걸립니다. 브랜드 이름이 한 글자라도 다르면 그 향수가
-- 통째로 빠지는데, 커밋한 뒤에는 무엇이 빠졌는지 찾기 어렵습니다.
--
-- 세는 것은 perfumes 전체가 아니라 loaded_perfumes, 즉 이번 CSV 로 들어온 향수뿐입니다.
-- 두 수는 다릅니다. 다른 경로로 들어온 향수가 있으면 perfumes 는 129,161 보다 큽니다.
-- loaded_perfumes 는 fragrantica_id 로 안쪽 조인해 만들었고 NULL 은 무엇과도 같지 않으므로,
-- 그 번호가 없는 향수는 애초에 들어오지 않습니다. 그래서 이 수는 CSV 행 수와 정확히 같습니다.
-- ---------------------------------------------------------------------------
DO $$
DECLARE
    loaded    bigint := (SELECT count(*) FROM loaded_perfumes);
    pa_loaded bigint := (SELECT count(*) FROM perfume_accords pa
                         JOIN loaded_perfumes l ON l.perfume_id = pa.perfume_id);
BEGIN
    IF loaded <> 129161 THEN
        RAISE EXCEPTION '적재된 향수가 모자랍니다: 기대 129161, 실제 % (브랜드 이름이 어긋난 행이 있습니다)', loaded;
    END IF;
    IF pa_loaded <> 1000570 THEN
        RAISE EXCEPTION '적재된 향 특성이 모자랍니다: 기대 1000570, 실제 % (accord 이름이 어긋난 행이 있습니다)', pa_loaded;
    END IF;
END $$;

COMMIT;

-- ---------------------------------------------------------------------------
-- 8. 통계를 다시 모읍니다.
--
-- 향수가 200개에서 129,161개로 늘었습니다. 통계가 옛 크기를 들고 있으면 실행 계획이 인덱스를
-- 건너뛰고 전체를 훑습니다. 자동 수집을 기다리지 않고 여기서 끝냅니다.
-- ---------------------------------------------------------------------------
ANALYZE brands;
ANALYZE accords;
ANALYZE perfumes;
ANALYZE perfume_accords;
