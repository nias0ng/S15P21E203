-- 단종이 확인된 향수를 perfumes 에 표시합니다. 추천(자연어 · 비슷한 향수 · 개인화)이 이 칸으로
-- 단종 향수를 빼고, 향수 상세가 '단종' 으로 적습니다.
--
-- 실행 (이 디렉터리에서):
--     ./load_perfume_status.sh
--
-- 선행 조건: perfumes 가 채워져 있어야 합니다 — load_perfume_catalog.sh 뒤입니다.
-- 원본은 ai/data/perfume_status.csv 하나입니다. AI 엔진도 같은 파일로 자연어 추천 후보를 거릅니다.
--
-- ⚠ '확정'(CONFIRMED)만 반영합니다. '추정'(LIKELY · 브랜드 공식 판매 목록에서만 빠진 것)은 파일에만
-- 두고 DB 에 넣지 않습니다 — 아직 파는 향수를 잘못 빼는 쪽이 더 나쁩니다. 판정 기준은
-- ai/README.md 의 '단종 목록' 에 있습니다.
--
-- 몇 번을 실행해도 결과가 같고 전체가 한 트랜잭션입니다. 표시를 모두 지우고 파일대로 다시 겁니다 —
-- 파일에서 지운 향수(다시 출시된 향수 등)의 표시도 그래서 함께 풀립니다. 검증 하나라도 실패하면
-- 아무것도 바꾸지 않습니다.

\set ON_ERROR_STOP on
\pset pager off
\timing on

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. CSV 를 변환 전 TEXT 로 받습니다.
-- ---------------------------------------------------------------------------
CREATE TEMP TABLE stg_perfume_status (
    fragrantica_id TEXT,
    brand          TEXT,
    name           TEXT,
    status         TEXT,
    confidence     TEXT,
    source_url     TEXT,
    checked_at     TEXT,
    note           TEXT
) ON COMMIT DROP;

\copy stg_perfume_status FROM 'perfume_status.csv' WITH (FORMAT csv, HEADER true, ENCODING 'UTF8')

-- ---------------------------------------------------------------------------
-- 2. 형식을 봅니다. 사람이 손으로 적는 파일이라 칸이 비거나 값이 틀리기 쉽습니다.
-- ---------------------------------------------------------------------------
DO $$
DECLARE
    invalid_format bigint := (SELECT count(*) FROM stg_perfume_status
                               WHERE fragrantica_id IS NULL
                                  OR fragrantica_id !~ '^[1-9][0-9]*$'
                                  OR status IS DISTINCT FROM 'DISCONTINUED'
                                  OR confidence NOT IN ('CONFIRMED', 'LIKELY')
                                  OR confidence IS NULL
                                  OR source_url !~ '^https?://'
                                  OR source_url IS NULL
                                  OR checked_at !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
                                  OR checked_at IS NULL);
    duplicates     bigint := (SELECT count(*) FROM (
                                   SELECT fragrantica_id FROM stg_perfume_status
                                   GROUP BY 1 HAVING count(*) > 1) duplicated);
BEGIN
    IF invalid_format <> 0 THEN
        RAISE EXCEPTION '형식이 잘못된 행이 %개입니다 (번호 · 상태 DISCONTINUED · 확실도 CONFIRMED/LIKELY'
            ' · 출처 http(s) · 확인일 YYYY-MM-DD)', invalid_format;
    END IF;
    IF duplicates <> 0 THEN
        RAISE EXCEPTION '같은 향수가 %번 겹칩니다. 한 향수에 한 줄입니다', duplicates;
    END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 3. ⚠ 번호가 정말 그 향수인지 이름으로 되짚습니다.
--
-- 손으로 적은 번호라 한 자리만 틀려도 엉뚱한 향수가 단종으로 적힙니다. 파일의 이름과 우리
-- perfumes.name 이 하나라도 다르면 멈추고 어긋난 줄을 보여 줍니다.
-- ---------------------------------------------------------------------------
DO $$
DECLARE
    mismatch text;
BEGIN
    SELECT string_agg(s.fragrantica_id || ' ' || coalesce(s.name, '?') || ' (DB: '
                      || coalesce(p.name, '없음') || ')', ', ')
    INTO mismatch
    FROM stg_perfume_status s
    LEFT JOIN perfumes p ON p.fragrantica_id = s.fragrantica_id::bigint
    WHERE p.perfume_id IS NULL OR lower(btrim(p.name)) <> lower(btrim(s.name));

    IF mismatch IS NOT NULL THEN
        RAISE EXCEPTION '번호와 이름이 맞지 않거나 카탈로그에 없는 향수가 있습니다: %', mismatch;
    END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 4. 표시를 모두 지우고 확정만 다시 겁니다.
-- ---------------------------------------------------------------------------
UPDATE perfumes
SET production_status = NULL,
    production_status_checked_at = NULL,
    production_status_source = NULL
WHERE production_status IS NOT NULL;

UPDATE perfumes p
SET production_status = s.status,
    production_status_checked_at = s.checked_at::date,
    production_status_source = s.source_url
FROM stg_perfume_status s
WHERE s.confidence = 'CONFIRMED'
  AND p.fragrantica_id = s.fragrantica_id::bigint;

DO $$
DECLARE
    expected bigint := (SELECT count(*) FROM stg_perfume_status WHERE confidence = 'CONFIRMED');
    marked   bigint := (SELECT count(*) FROM perfumes WHERE production_status IS NOT NULL);
    likely   bigint := (SELECT count(*) FROM stg_perfume_status WHERE confidence = 'LIKELY');
BEGIN
    IF marked <> expected THEN
        RAISE EXCEPTION '단종 표시가 맞지 않습니다: 기대 %, 실제 %', expected, marked;
    END IF;
    RAISE NOTICE '단종 확정 %개를 표시했습니다. 추정 %개는 파일에만 두었습니다.', marked, likely;
END $$;

SELECT count(*) FILTER (WHERE production_status = 'DISCONTINUED') AS discontinued
FROM perfumes;

COMMIT;
