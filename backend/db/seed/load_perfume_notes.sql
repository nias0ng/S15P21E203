-- 향수와 노트의 연결을 적재합니다. 노트별 향수 조회(GET /api/v1/notes/{noteId}/perfumes)가
-- 읽는 표입니다.
--
-- 실행 (이 디렉터리에서):
--     ./load_perfume_notes.sh
--
-- 선행 조건이 둘입니다. notes 와 perfumes 가 모두 채워져 있어야 합니다 — 이 표는 그 둘을
-- 잇기만 합니다. 순서는 load_notes.sh 와 load_perfume_catalog.sh 뒤입니다.
--
-- 몇 번을 실행해도 결과가 같고 전체가 한 트랜잭션입니다. 검증 하나라도 실패하면 아무것도
-- 반영하지 않습니다.
--
-- ⚠ CSV 의 perfume_id 는 우리 perfumes.perfume_id 가 아니라 fragrantica_id 입니다. 둘 다 1부터
-- 촘촘한 정수라 잘못 조인해도 12만 행이 "붙어" 버리고, 그러면 모든 향수에 남의 노트가 달립니다.
-- 오류도 나지 않아 화면을 봐야 겨우 알아챕니다. 그래서 아래 3번에서 CSV 의 perfume_name 과
-- 우리 perfumes.name 이 실제로 같은지 확인하고, 다르면 적재를 멈춥니다. CSV 가 향수 이름과
-- 브랜드를 함께 싣고 있는 덕분에 가능한 검증입니다.

\set ON_ERROR_STOP on
\pset pager off
\timing on

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. CSV 를 변환 전 TEXT 로 받습니다.
--
-- name_ko · accord_family 는 notes 가 이미 갖고 있어 쓰지 않습니다. perfume_name · brand 는
-- 3번 검증에 씁니다.
-- ---------------------------------------------------------------------------
CREATE TEMP TABLE stg_perfume_notes (
    note           TEXT,
    name_ko        TEXT,
    accord_family  TEXT,
    fragrantica_id TEXT,
    perfume_name   TEXT,
    brand          TEXT,
    positions      TEXT
) ON COMMIT DROP;

\copy stg_perfume_notes FROM 'perfume_notes.csv' WITH (FORMAT csv, HEADER true, ENCODING 'UTF8')

-- Fragrantica 9110은 정식 Eclat d’Arpège(988)의 크롤링 중복입니다.
DELETE FROM stg_perfume_notes WHERE fragrantica_id = '9110';

-- ---------------------------------------------------------------------------
-- 2. 전달 데이터가 형식에 맞는지 먼저 봅니다.
-- ---------------------------------------------------------------------------
DO $$
DECLARE
    row_count        bigint := (SELECT count(*) FROM stg_perfume_notes);
    invalid_required bigint := (SELECT count(*) FROM stg_perfume_notes
                                 WHERE NULLIF(btrim(note), '') IS NULL
                                    OR NULLIF(btrim(positions), '') IS NULL
                                    OR fragrantica_id !~ '^[1-9][0-9]*$');
    bad_positions    bigint := (SELECT count(*) FROM stg_perfume_notes
                                 WHERE btrim(positions) <> ALL (ARRAY[
                                     'top', 'middle', 'base', 'flat',
                                     'top+middle', 'top+base', 'middle+base',
                                     'top+middle+base']));
    duplicate_pairs  bigint := (SELECT count(*) FROM (
                                     SELECT btrim(note), fragrantica_id
                                     FROM stg_perfume_notes
                                     GROUP BY 1, 2 HAVING count(*) > 1) duplicated);
    unknown_notes    bigint := (SELECT count(DISTINCT s.note)
                                FROM stg_perfume_notes s
                                LEFT JOIN notes n ON n.name = btrim(s.note)
                                WHERE n.note_id IS NULL);
BEGIN
    IF row_count = 0 THEN
        RAISE EXCEPTION 'CSV 가 비었습니다';
    END IF;
    IF invalid_required <> 0 THEN
        RAISE EXCEPTION '필수값이 비었거나 향수 번호 형식이 잘못된 행이 %개입니다', invalid_required;
    END IF;
    IF bad_positions <> 0 THEN
        RAISE EXCEPTION '노트 위치 값이 알 수 없는 행이 %개입니다', bad_positions;
    END IF;
    IF duplicate_pairs <> 0 THEN
        RAISE EXCEPTION '같은 (노트, 향수) 짝이 %개 중복입니다', duplicate_pairs;
    END IF;
    -- 노트가 먼저 들어와 있어야 합니다. 이 표는 잇기만 하고 노트를 만들지 않습니다.
    IF unknown_notes <> 0 THEN
        RAISE EXCEPTION 'notes 에 없는 노트가 %종류입니다. load_notes.sh 를 먼저 실행하십시오',
            unknown_notes;
    END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 3. ⚠ 향수 번호를 어느 열로 읽을지 확인합니다 — 이 검증이 이 파일의 핵심입니다.
--
-- fragrantica_id 로 조인했을 때 CSV 의 향수 이름과 우리 이름이 같아야 합니다. perfume_id 로
-- 잘못 조인하면 이름이 전혀 다른 향수에 붙는데, 조인 자체는 12만 건이나 성공해서 행 수만으로는
-- 알아챌 수 없습니다.
-- ---------------------------------------------------------------------------
DO $$
DECLARE
    joined     bigint;
    name_match bigint;
BEGIN
    WITH pairs AS (
        SELECT DISTINCT fragrantica_id::bigint AS fid, btrim(perfume_name) AS csv_name
        FROM stg_perfume_notes
    )
    SELECT count(*), count(*) FILTER (WHERE lower(p.name) = lower(s.csv_name))
    INTO joined, name_match
    FROM pairs s JOIN perfumes p ON p.fragrantica_id = s.fid;

    IF joined = 0 THEN
        RAISE EXCEPTION 'CSV 의 향수 번호가 perfumes.fragrantica_id 와 하나도 맞지 않습니다.'
            ' load_perfume_catalog.sh 를 먼저 실행하십시오';
    END IF;
    -- 이름이 다른 소수는 카탈로그 갱신으로 표기가 바뀐 경우입니다. 대다수가 어긋나면 번호의
    -- 의미 자체가 다른 것이라 멈춥니다.
    IF name_match * 100 < joined * 99 THEN
        RAISE EXCEPTION 'fragrantica_id 로 이은 향수의 이름이 CSV 와 다릅니다 (%/% 일치).'
            ' CSV 의 perfume_id 가 우리 perfume_id 를 뜻하는지 확인하십시오',
            name_match, joined;
    END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 4. fragrantica_id 를 우리 번호로 바꿔 넣습니다.
--
-- 우리 perfumes 에 없는 향수를 가리키는 행은 버립니다. 카탈로그가 전체를 담지 않아 생기는
-- 정상적인 차이이고, 없는 향수에 노트만 달아 둘 수는 없습니다. 몇 행이 버려졌는지는 5번이
-- 알려 줍니다.
-- ---------------------------------------------------------------------------
INSERT INTO perfume_notes (perfume_id, note_id, note_type)
SELECT p.perfume_id, n.note_id, btrim(s.positions)
FROM stg_perfume_notes s
JOIN perfumes p ON p.fragrantica_id = s.fragrantica_id::bigint
JOIN notes n     ON n.name = btrim(s.note)
ON CONFLICT (perfume_id, note_id) DO UPDATE SET
    note_type = EXCLUDED.note_type;

-- ---------------------------------------------------------------------------
-- 5. 넣을 수 있던 행이 모두 들어갔는지 확인합니다.
-- ---------------------------------------------------------------------------
DO $$
DECLARE
    expected bigint := (SELECT count(*)
                        FROM stg_perfume_notes s
                        JOIN perfumes p ON p.fragrantica_id = s.fragrantica_id::bigint
                        JOIN notes n     ON n.name = btrim(s.note));
    loaded   bigint := (SELECT count(*)
                        FROM stg_perfume_notes s
                        JOIN perfumes p       ON p.fragrantica_id = s.fragrantica_id::bigint
                        JOIN notes n          ON n.name = btrim(s.note)
                        JOIN perfume_notes pn ON pn.perfume_id = p.perfume_id
                                             AND pn.note_id = n.note_id
                        WHERE pn.note_type = btrim(s.positions));
    skipped  bigint := (SELECT count(*)
                        FROM stg_perfume_notes s
                        LEFT JOIN perfumes p ON p.fragrantica_id = s.fragrantica_id::bigint
                        WHERE p.perfume_id IS NULL);
BEGIN
    IF loaded <> expected THEN
        RAISE EXCEPTION '반영된 연결이 모자랍니다: 기대 %, 실제 %', expected, loaded;
    END IF;
    RAISE NOTICE '연결 %건을 반영했습니다. 카탈로그에 없는 향수를 가리켜 건너뛴 행 %건.',
        loaded, skipped;
END $$;

SELECT count(*)                  AS loaded_links,
       count(DISTINCT note_id)   AS linked_notes,
       count(DISTINCT perfume_id) AS linked_perfumes
FROM perfume_notes;

COMMIT;

ANALYZE perfume_notes;
