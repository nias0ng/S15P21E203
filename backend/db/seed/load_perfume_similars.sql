-- 향 지도 밖 향수의 '비슷한 향수' 를 적재합니다. 향수 상세의 비슷한 향수
-- (GET /api/v1/perfumes/{id}/similar)가 perfume_neighbors 에 없는 향수에서 읽는 표입니다.
--
-- 실행 (이 디렉터리에서):
--     ./load_perfume_similars.sh
--
-- 선행 조건: perfumes 가 채워져 있어야 합니다 — load_perfume_catalog.sh 뒤입니다.
-- CSV 는 ai/build_similars.py 가 만듭니다. 공식과 걸러 내는 규칙은 그 파일 머리말에 있습니다.
--
-- 몇 번을 실행해도 결과가 같고 전체가 한 트랜잭션입니다. 표를 통째로 비우고 다시 넣습니다 —
-- 다시 계산하면 향수마다 목록 전체가 바뀌어(순서 · 짝) 행 단위로 고쳐 넣을 것이 없습니다.
-- 검증 하나라도 실패하면 아무것도 반영하지 않으므로 지금 있던 목록이 그대로 남습니다.
--
-- 4번의 DELETE 도 이 트랜잭션 안이라, 넣는 도중에 오류가 나거나 접속이 끊겨도 지운 것까지 함께
-- 되돌아갑니다(ON_ERROR_STOP · COMMIT 전 끊김은 ROLLBACK). 적재하는 동안 서비스는 COMMIT 전까지
-- 옛 목록을 그대로 읽습니다 — DELETE 는 읽기를 막지 않습니다. 임시 표에 넣고 이름을 바꿔 끼우는
-- 방식은 이 점에서 더 안전하지 않고, 바꿔 끼우는 순간 ACCESS EXCLUSIVE 잠금으로 읽기를 막습니다.
--
-- ⚠ CSV 의 두 번호는 우리 perfumes.perfume_id 가 아니라 fragrantica_id 입니다. 둘 다 1부터
-- 촘촘한 정수라 잘못 조인해도 행이 "붙어" 버립니다. 아래 4번에서 적재된 짝이 CSV 의 짝과
-- 같은 fragrantica_id 를 가리키는지 되짚습니다.

\set ON_ERROR_STOP on
\pset pager off
\timing on

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. CSV 를 변환 전 TEXT 로 받습니다.
-- ---------------------------------------------------------------------------
CREATE TEMP TABLE stg_perfume_similars (
    fragrantica_id         TEXT,
    similar_fragrantica_id TEXT,
    similarity             TEXT,
    rank                   TEXT
) ON COMMIT DROP;

\copy stg_perfume_similars FROM 'perfume_similars.csv' WITH (FORMAT csv, HEADER true, ENCODING 'UTF8')

-- Fragrantica 9110은 정식 Eclat d’Arpège(988)의 크롤링 중복입니다. 계산에서 이미 뺐지만 다시 막습니다.
DELETE FROM stg_perfume_similars
WHERE fragrantica_id = '9110' OR similar_fragrantica_id = '9110';

-- ---------------------------------------------------------------------------
-- 2. 전달 데이터가 형식에 맞는지 먼저 봅니다.
-- ---------------------------------------------------------------------------
DO $$
DECLARE
    row_count        bigint := (SELECT count(*) FROM stg_perfume_similars);
    invalid_format   bigint := (SELECT count(*) FROM stg_perfume_similars
                                 WHERE fragrantica_id !~ '^[1-9][0-9]*$'
                                    OR similar_fragrantica_id !~ '^[1-9][0-9]*$'
                                    OR rank !~ '^[1-9][0-9]*$'
                                    OR similarity !~ '^[0-9]*\.?[0-9]+$');
    bad_similarity   bigint;
    self_pairs       bigint;
    duplicate_pairs  bigint := (SELECT count(*) FROM (
                                     SELECT fragrantica_id, similar_fragrantica_id
                                     FROM stg_perfume_similars
                                     GROUP BY 1, 2 HAVING count(*) > 1) duplicated);
    duplicate_ranks  bigint := (SELECT count(*) FROM (
                                     SELECT fragrantica_id, rank
                                     FROM stg_perfume_similars
                                     GROUP BY 1, 2 HAVING count(*) > 1) duplicated);
BEGIN
    IF row_count = 0 THEN
        RAISE EXCEPTION 'CSV 가 비었습니다';
    END IF;
    IF invalid_format <> 0 THEN
        RAISE EXCEPTION '번호 · 순서 · 유사도 형식이 잘못된 행이 %개입니다', invalid_format;
    END IF;
    SELECT count(*) FILTER (WHERE similarity::numeric <= 0 OR similarity::numeric > 1),
           count(*) FILTER (WHERE fragrantica_id = similar_fragrantica_id)
    INTO bad_similarity, self_pairs
    FROM stg_perfume_similars;
    IF bad_similarity <> 0 THEN
        RAISE EXCEPTION '유사도가 0 초과 1 이하가 아닌 행이 %개입니다', bad_similarity;
    END IF;
    IF self_pairs <> 0 THEN
        RAISE EXCEPTION '자기 자신을 가리키는 행이 %개입니다', self_pairs;
    END IF;
    IF duplicate_pairs <> 0 THEN
        RAISE EXCEPTION '같은 (향수, 비슷한 향수) 짝이 %개 중복입니다', duplicate_pairs;
    END IF;
    IF duplicate_ranks <> 0 THEN
        RAISE EXCEPTION '한 향수 안에서 같은 순서가 %번 겹칩니다', duplicate_ranks;
    END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 3. 카탈로그가 먼저 들어와 있는지 봅니다.
--
-- CSV 는 카탈로그와 같은 원본(perfumes_nlr.csv.gz)에서 나와 거의 모든 번호가 맞아야 합니다.
-- 대다수가 안 맞으면 카탈로그가 비었거나 다른 원본인 것이라 멈춥니다.
-- ---------------------------------------------------------------------------
DO $$
DECLARE
    sources bigint := (SELECT count(DISTINCT fragrantica_id) FROM stg_perfume_similars);
    found   bigint := (SELECT count(DISTINCT s.fragrantica_id)
                       FROM stg_perfume_similars s
                       JOIN perfumes p ON p.fragrantica_id = s.fragrantica_id::bigint);
BEGIN
    IF found = 0 THEN
        RAISE EXCEPTION 'CSV 의 향수 번호가 perfumes.fragrantica_id 와 하나도 맞지 않습니다.'
            ' load_perfume_catalog.sh 를 먼저 실행하십시오';
    END IF;
    IF found * 100 < sources * 99 THEN
        RAISE EXCEPTION '카탈로그에 있는 향수가 %/% 뿐입니다. 카탈로그를 먼저 적재하십시오',
            found, sources;
    END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 4. 비우고 우리 번호로 바꿔 넣습니다.
--
-- 두 쪽 중 하나라도 카탈로그에 없으면 그 행은 버립니다. 그 자리의 순서가 비어도 남은 것의
-- 차례는 그대로라 화면에서는 다음 향수가 올라옵니다.
-- ---------------------------------------------------------------------------
DELETE FROM perfume_similars;

INSERT INTO perfume_similars (perfume_id, similar_perfume_id, similarity, rank)
SELECT p.perfume_id, q.perfume_id, s.similarity::numeric(5, 4), s.rank::smallint
FROM stg_perfume_similars s
JOIN perfumes p ON p.fragrantica_id = s.fragrantica_id::bigint
JOIN perfumes q ON q.fragrantica_id = s.similar_fragrantica_id::bigint;

DO $$
DECLARE
    expected bigint := (SELECT count(*)
                        FROM stg_perfume_similars s
                        JOIN perfumes p ON p.fragrantica_id = s.fragrantica_id::bigint
                        JOIN perfumes q ON q.fragrantica_id = s.similar_fragrantica_id::bigint);
    -- 넣은 짝을 다시 fragrantica_id 로 되짚어 CSV 와 같은지 봅니다 (머리말의 ⚠)
    matched  bigint := (SELECT count(*)
                        FROM perfume_similars ps
                        JOIN perfumes p ON p.perfume_id = ps.perfume_id
                        JOIN perfumes q ON q.perfume_id = ps.similar_perfume_id
                        JOIN stg_perfume_similars s
                          ON s.fragrantica_id::bigint = p.fragrantica_id
                         AND s.similar_fragrantica_id::bigint = q.fragrantica_id
                         AND s.rank::smallint = ps.rank);
    skipped  bigint := (SELECT count(*) FROM stg_perfume_similars) - expected;
BEGIN
    IF matched <> expected THEN
        RAISE EXCEPTION '넣은 짝이 CSV 와 다릅니다: 기대 %, 일치 %', expected, matched;
    END IF;
    RAISE NOTICE '비슷한 향수 %건을 넣었습니다. 카탈로그에 없는 향수를 가리켜 건너뛴 행 %건.',
        expected, skipped;
END $$;

SELECT count(*)                   AS loaded_pairs,
       count(DISTINCT perfume_id) AS perfumes_with_similars,
       min(similarity)            AS min_similarity,
       max(similarity)            AS max_similarity
FROM perfume_similars;

COMMIT;

ANALYZE perfume_similars;
