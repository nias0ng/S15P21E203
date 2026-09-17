-- 노트 마스터 246개와 화면 표시용 메타데이터를 적재합니다.
--
-- 실행 (이 디렉터리에서):
--     ./load_notes.sh
--
-- 스키마는 V21 까지 적용돼 있어야 합니다 (description 은 V21 에서 생겼습니다). notes.name 은 V5 부터 유일하므로, 같은 영문 이름의
-- 기존 노트가 있으면 note_id 를 유지한 채 메타데이터만 갱신하고 없으면 새 ID 를 자동 생성합니다.
-- CSV 의 popularity_rank 는 통계 순위이며 note_id 로 사용하지 않습니다.
--
-- 몇 번을 실행해도 결과가 같고 전체가 한 트랜잭션입니다. 검증 하나라도 실패하면 아무것도
-- 반영하지 않습니다. CSV 에 없는 기존 노트의 활성 상태와 메타데이터는 건드리지 않습니다.

\set ON_ERROR_STOP on
\pset pager off
\timing on

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. CSV 를 변환 전 TEXT 로 받습니다.
-- ---------------------------------------------------------------------------
CREATE TEMP TABLE stg_notes (
    popularity_rank TEXT,
    name            TEXT,
    name_ko         TEXT,
    accord_family   TEXT,
    image_url       TEXT,
    description     TEXT
) ON COMMIT DROP;

\copy stg_notes FROM 'notes.csv' WITH (FORMAT csv, HEADER true)

-- ---------------------------------------------------------------------------
-- 2. 전달 데이터가 완전하고 유일한지 먼저 검증합니다.
-- ---------------------------------------------------------------------------
DO $$
DECLARE
    note_count          bigint := (SELECT count(*) FROM stg_notes);
    invalid_required    bigint := (SELECT count(*) FROM stg_notes
                                    WHERE NULLIF(name, '') IS NULL
                                       OR NULLIF(name_ko, '') IS NULL
                                       OR NULLIF(accord_family, '') IS NULL
                                       OR NULLIF(image_url, '') IS NULL
                                       OR popularity_rank !~ '^[1-9][0-9]*$');
    duplicate_names     bigint := (SELECT count(*) FROM (
                                        SELECT name FROM stg_notes
                                        GROUP BY name HAVING count(*) > 1
                                    ) duplicated);
    duplicate_ranks     bigint := (SELECT count(*) FROM (
                                        SELECT popularity_rank FROM stg_notes
                                        GROUP BY popularity_rank HAVING count(*) > 1
                                    ) duplicated);
    duplicate_urls      bigint := (SELECT count(*) FROM (
                                        SELECT image_url FROM stg_notes
                                        GROUP BY image_url HAVING count(*) > 1
                                    ) duplicated);
    invalid_image_urls  bigint := (SELECT count(*) FROM stg_notes
                                    WHERE image_url !~ '^https://djpgc0m2v54q1[.]cloudfront[.]net/notes/[a-z0-9]+(-[a-z0-9]+)*[.]jpg$');
    -- description 은 비어 있어도 됩니다. 컬럼이 NULL 을 허용하는 이유와 같습니다 — 설명이
    -- 아직 없는 노트를 넣을 수 있어야 합니다. 다만 한두 글자짜리는 열이 밀린 흔적이라 막습니다.
    truncated_descs     bigint := (SELECT count(*) FROM stg_notes
                                    WHERE NULLIF(btrim(description), '') IS NOT NULL
                                      AND char_length(btrim(description)) < 10);
BEGIN
    IF note_count <> 246 THEN
        RAISE EXCEPTION '노트 수가 다릅니다: 기대 246, 실제 %', note_count;
    END IF;
    IF invalid_required <> 0 THEN
        RAISE EXCEPTION '필수값이 비었거나 순위 형식이 잘못된 노트가 %개입니다', invalid_required;
    END IF;
    IF duplicate_names <> 0 THEN
        RAISE EXCEPTION '중복 영문 이름이 %개입니다', duplicate_names;
    END IF;
    IF duplicate_ranks <> 0 THEN
        RAISE EXCEPTION '중복 인기 순위가 %개입니다', duplicate_ranks;
    END IF;
    IF duplicate_urls <> 0 THEN
        RAISE EXCEPTION '중복 이미지 URL이 %개입니다', duplicate_urls;
    END IF;
    IF invalid_image_urls <> 0 THEN
        RAISE EXCEPTION 'CloudFront 노트 이미지 URL 형식이 잘못된 행이 %개입니다', invalid_image_urls;
    END IF;
    IF truncated_descs <> 0 THEN
        RAISE EXCEPTION '설명이 10자 미만인 행이 %개입니다 (열이 밀렸는지 확인하세요)', truncated_descs;
    END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 3. 영문 이름으로 기존 노트를 찾아 갱신하거나 새로 넣습니다.
--
-- is_active 는 갱신하지 않습니다. 운영에서 비활성화한 노트를 시드 재실행이 되살리면 안 됩니다.
-- ---------------------------------------------------------------------------
INSERT INTO notes (name, name_ko, accord_family, image_url, popularity_rank, description)
SELECT name,
       name_ko,
       accord_family,
       image_url,
       popularity_rank::integer,
       NULLIF(btrim(description), '')
FROM stg_notes
ON CONFLICT (name) DO UPDATE SET
    name_ko         = EXCLUDED.name_ko,
    accord_family   = EXCLUDED.accord_family,
    image_url       = EXCLUDED.image_url,
    popularity_rank = EXCLUDED.popularity_rank,
    -- 빈 설명이 기존 설명을 지우지 않습니다. 다른 열은 위에서 비어 있지 않음을 검증했지만
    -- 설명만은 비어도 통과하므로, 여기서 덮어쓰면 재실행 한 번에 조용히 사라집니다.
    description     = COALESCE(EXCLUDED.description, notes.description);

-- ---------------------------------------------------------------------------
-- 4. 조인 누락 없이 246개가 모두 반영됐는지 확인합니다.
-- ---------------------------------------------------------------------------
DO $$
DECLARE
    loaded_count bigint := (SELECT count(*)
                            FROM notes n
                            JOIN stg_notes s ON s.name = n.name
                            WHERE n.name_ko = s.name_ko
                              AND n.accord_family = s.accord_family
                              AND n.image_url = s.image_url
                              AND n.popularity_rank = s.popularity_rank::integer);
    expected_descs bigint := (SELECT count(*) FROM stg_notes
                              WHERE NULLIF(btrim(description), '') IS NOT NULL);
    loaded_descs   bigint := (SELECT count(*)
                              FROM notes n
                              JOIN stg_notes s ON s.name = n.name
                              WHERE n.description = NULLIF(btrim(s.description), ''));
BEGIN
    IF loaded_count <> 246 THEN
        RAISE EXCEPTION '메타데이터가 일치하는 노트가 모자랍니다: 기대 246, 실제 %', loaded_count;
    END IF;
    IF loaded_descs <> expected_descs THEN
        RAISE EXCEPTION '설명이 일치하는 노트가 모자랍니다: 기대 %, 실제 %', expected_descs, loaded_descs;
    END IF;
END $$;

SELECT count(*) AS loaded_notes,
       count(image_url) AS notes_with_image,
       count(popularity_rank) AS ranked_notes,
       count(description) AS notes_with_description
FROM notes
WHERE name IN (SELECT name FROM stg_notes);

COMMIT;

ANALYZE notes;
