-- 후기 시드 적재. 후기 키워드 추출 배치를 수동으로 확인하려면 후기가 쌓인 향수가 있어야 합니다.
--
-- 실행 (이 디렉터리에서):
--     psql "$DATABASE_URL" -f load_review_seed.sql
--
-- 스키마는 V7 까지 적용돼 있어야 합니다. 향 지도 적재(load_scent_map.sql)를 먼저 돌려
-- 향수가 들어 있어야 합니다. 이 스크립트는 향수를 만들지 않고 이미 있는 향수에 후기를 붙입니다.
--
-- 몇 번을 다시 돌려도 결과가 같습니다. 지난 실행이 넣은 후기와 사용자를 지운 뒤 다시 넣습니다.
-- 전체가 한 트랜잭션이라 중간에 하나라도 어긋나면 아무것도 반영되지 않습니다.
--
-- 운영 데이터베이스에서 돌리지 마세요. 사람이 쓴 후기와 섞이면 어느 것이 시드인지 구분되지
-- 않습니다. 구분 근거는 사용자의 이메일 도메인(@seed.hyanghae.test)뿐입니다.

\set ON_ERROR_STOP on
\timing off

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. 후기를 붙일 향수를 고릅니다.
--
-- 번호가 가장 작은 활성 향수 3개입니다. 이름으로 지목하지 않는 이유가 있습니다. 향 지도를
-- 다시 만들면 향수 번호와 구성이 통째로 바뀌는데, 이름으로 찾으면 그때 시드가 조용히
-- 아무것도 넣지 않게 됩니다.
--
-- 시드가 아닌 후기가 이미 달린 향수는 건너뜁니다. 손으로 넣어 둔 후기와 섞이면 향수별 후기 수가
-- 아래 표와 달라져 정책 경계를 확인할 수 없고, 남의 데이터를 지우지 않고는 시드를 돌릴 수
-- 없게 됩니다.
--
-- 지난 실행이 넣은 시드 후기는 이 조건에 걸리지 않습니다. 그래서 다시 돌려도 같은 향수가
-- 다시 뽑힙니다. 이 구분이 없으면 실행마다 다른 향수에 후기가 쌓입니다.
--
-- 향수마다 후기 수를 다르게 두었습니다. 배치의 최소 개수 정책(기본 5건)이 어디서 갈리는지
-- 한 번의 실행으로 보이게 하려는 것입니다.
--   1번 자리: 6건  - 최소 개수를 넘겨 키워드가 생깁니다.
--   2번 자리: 12건 - 후기가 많을 때의 프롬프트 크기를 봅니다.
--   3번 자리: 4건  - 최소 개수에 하나 모자라 대상이 되지 않습니다.
-- ---------------------------------------------------------------------------
CREATE TEMP TABLE seed_perfumes (
    slot       INTEGER PRIMARY KEY,
    perfume_id BIGINT NOT NULL
) ON COMMIT DROP;

INSERT INTO seed_perfumes (slot, perfume_id)
SELECT row_number() OVER (ORDER BY perfume_id), perfume_id
FROM (
    SELECT p.perfume_id
    FROM perfumes p
    WHERE p.is_active = TRUE
      AND NOT EXISTS (
          SELECT 1
          FROM perfume_reviews r
          LEFT JOIN users u ON u.user_id = r.user_id
          WHERE r.perfume_id = p.perfume_id
            AND (u.email IS NULL OR u.email NOT LIKE '%@seed.hyanghae.test')
      )
    ORDER BY p.perfume_id
    LIMIT 3
) p;

DO $$
DECLARE
    found INTEGER;
BEGIN
    SELECT count(*) INTO found FROM seed_perfumes;
    IF found < 3 THEN
        RAISE EXCEPTION '후기가 없는 활성 향수가 %개뿐입니다. 향 지도 적재(load_scent_map.sql)를 먼저 실행하세요.', found;
    END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 2. 후기 원문.
--
-- 실제로 사람이 쓴 것처럼 보이는 문장이어야 합니다. AI 가 읽고 키워드를 뽑을 원문이라, 향 표현이
-- 고르게 반복되지 않으면 키워드 통계가 한두 개로 쏠려 확인할 것이 없어집니다.
--
-- 일부러 섞어 둔 것이 두 가지 있습니다.
--   - 배송·가격·용기 이야기가 섞인 후기: 지시문이 향과 무관한 표현을 키워드로 뽑지 말라고
--     하는데, 그 규칙이 실제로 지켜지는지 볼 수 있습니다.
--   - 향 표현이 아예 없는 후기: 키워드가 빈 배열로 오는 경우입니다. 이 후기가 키워드 백분율의
--     분모에서 빠지는 것까지가 정상입니다.
--
-- seq 는 후기 작성자를 정하는 번호이기도 합니다. 한 사용자는 한 향수에 후기를 하나만 가질 수
-- 있어(uk_perfume_reviews_user_perfume) 같은 향수 안에서 seq 가 겹치면 적재가 실패합니다.
-- ---------------------------------------------------------------------------
CREATE TEMP TABLE seed_reviews (
    slot    INTEGER NOT NULL,
    seq     INTEGER NOT NULL,
    title   VARCHAR(100) NOT NULL,
    content TEXT NOT NULL,
    PRIMARY KEY (slot, seq)
) ON COMMIT DROP;

INSERT INTO seed_reviews (slot, seq, title, content) VALUES
    -- 1번 자리: 달콤하고 포근한 계열로 모았습니다. 6건.
    (1, 1, '달콤한데 무겁지 않아요',
        '처음에는 배 같은 과일 향이 확 오는데 금방 가라앉고, 남는 것은 포근한 살냄새 같은 느낌입니다. 겨울에 니트 위에 뿌리면 하루 종일 은은하게 올라옵니다.'),
    (1, 2, '향은 좋은데 지속력이 짧아요',
        '달콤하고 부드러운 향이 정말 마음에 듭니다. 다만 두 시간쯤 지나면 거의 느껴지지 않아서 낮에 한 번 더 뿌려야 합니다.'),
    (1, 3, '포근한 파우더리',
        '파우더 느낌이 강해서 따뜻한 인상을 줍니다. 달달하지만 설탕처럼 인공적이지는 않아서 사무실에서도 부담이 없었습니다.'),
    (1, 4, '봄에 잘 맞습니다',
        '가볍고 산뜻한 꽃 향이 먼저 오고 뒤에 달콤한 잔향이 남습니다. 여름에는 조금 답답할 것 같습니다.'),
    (1, 5, '배송은 이틀 걸렸습니다',
        '향 자체는 무난하게 달콤한 편입니다. 용기가 생각보다 작아서 놀랐지만 가격을 생각하면 만족합니다.'),
    (1, 6, '선물로 받았어요',
        '아직 몇 번 써보지 않아서 뭐라고 말하기 어렵습니다. 조금 더 써보고 다시 남기겠습니다.'),

    -- 2번 자리: 시트러스에서 우디로 넘어가는 계열입니다. 12건.
    (2, 1, '시원하게 시작해서 나무로 끝납니다',
        '뿌린 직후에는 레몬처럼 시원한 향이 강하게 오고, 한 시간쯤 지나면 마른 나무 같은 향으로 바뀝니다. 변하는 과정이 재미있습니다.'),
    (2, 2, '여름 출근용으로 씁니다',
        '땀 냄새를 덮어주는 상쾌한 향입니다. 아침에 뿌리고 나가면 점심때까지 시원한 느낌이 남습니다.'),
    (2, 3, '지속력이 좋습니다',
        '오후 늦게까지 은은하게 남습니다. 향이 세지 않은데도 오래 가는 편이라 자주 뿌릴 필요가 없습니다.'),
    (2, 4, '생각보다 묵직합니다',
        '시트러스만 있을 줄 알았는데 뒤에 오는 우디 향이 꽤 무겁습니다. 가벼운 향을 찾는다면 다른 것을 보는 게 좋겠습니다.'),
    (2, 5, '깔끔한 비누 향',
        '갓 세탁한 셔츠 같은 깔끔한 느낌입니다. 튀지 않아서 누구를 만나도 무리가 없습니다.'),
    (2, 6, '남녀 모두 쓸 수 있어요',
        '특별히 남성적이거나 여성적이지 않은 중성적인 향입니다. 가족과 같이 쓰고 있습니다.'),
    (2, 7, '레몬 향이 강합니다',
        '처음 30분은 레몬과 라임 같은 시트러스가 아주 뚜렷합니다. 새콤한 향을 좋아하면 만족할 것 같습니다.'),
    (2, 8, '잔향이 마음에 듭니다',
        '초반보다 몇 시간 뒤에 남는 향이 더 좋습니다. 은은한 나무와 옅은 머스크가 섞인 느낌입니다.'),
    (2, 9, '환기되는 느낌입니다',
        '답답할 때 뿌리면 창문을 연 것처럼 시원합니다. 향이 무겁지 않아 실내에서도 편합니다.'),
    (2, 10, '가을에도 괜찮습니다',
        '여름용으로 샀는데 날이 선선해진 뒤에도 잘 어울립니다. 뒤에 오는 나무 향이 계절과 맞습니다.'),
    (2, 11, '뿌린 직후가 제일 좋습니다',
        '처음의 상쾌함이 가장 좋고 시간이 지나면 평범해집니다. 그래서 외출 직전에 뿌립니다.'),
    (2, 12, '재구매했습니다',
        '한 병을 다 쓰고 다시 샀습니다. 시원하고 깔끔한 향이 사계절 무난합니다.'),

    -- 3번 자리: 최소 개수에 하나 모자라도록 4건만 둡니다.
    (3, 1, '묵직한 우디',
        '나무와 향신료가 섞인 무거운 향입니다. 뿌리는 양을 조금만 해도 충분합니다.'),
    (3, 2, '밤에 어울립니다',
        '낮보다 저녁에 어울리는 진한 향입니다. 옷에 남은 잔향이 다음 날까지 느껴집니다.'),
    (3, 3, '호불호가 갈릴 것 같습니다',
        '개인적으로는 좋아하지만 주변에서는 너무 진하다는 말을 들었습니다. 시향 후에 사는 것을 권합니다.'),
    (3, 4, '가죽 같은 느낌이 있어요',
        '가죽과 담배 같은 향이 옅게 섞여 있습니다. 어른스러운 인상을 줍니다.');

-- ---------------------------------------------------------------------------
-- 3. 지난 실행이 넣은 것을 지웁니다.
--
-- 순서가 중요합니다. perfume_reviews.user_id 의 외래키가 ON DELETE SET NULL 이라 사용자를
-- 먼저 지우면 후기가 작성자 없는 행으로 남아 다음 실행에서 지울 수 없게 됩니다. 그러면
-- 시드를 돌릴 때마다 후기가 쌓입니다.
--
-- 후기에 붙은 키워드(perfume_review_keywords)는 후기가 지워질 때 함께 지워집니다.
-- 외래키가 ON DELETE CASCADE 입니다.
--
-- 대상 향수의 요약 행도 지웁니다. 지금 배치는 요약을 만들지 않지만, 예전에 만들어졌거나 손으로
-- 넣어 둔 행이 남아 있으면 이제 존재하지 않는 후기로 만든 요약이 화면에 계속 보입니다.
-- ---------------------------------------------------------------------------
DELETE FROM perfume_reviews
WHERE user_id IN (SELECT user_id FROM users WHERE email LIKE '%@seed.hyanghae.test');

DELETE FROM users
WHERE email LIKE '%@seed.hyanghae.test';

DELETE FROM perfume_review_summaries
WHERE perfume_id IN (SELECT perfume_id FROM seed_perfumes);

-- ---------------------------------------------------------------------------
-- 4. 후기를 쓸 사용자.
--
-- 한 향수에 후기를 하나만 가질 수 있으므로 후기가 가장 많은 향수(12건)에 맞춰 12명을 만듭니다.
-- 같은 사람이 여러 향수에 후기를 쓰는 것은 정상입니다.
--
-- password_hash 는 해시가 아닌 문자열입니다. 어떤 비밀번호로도 이 계정에 로그인되지 않게
-- 하려는 것이고, 시드 계정에 진짜 비밀번호를 두지 않기 위한 것입니다.
-- ---------------------------------------------------------------------------
INSERT INTO users (email, password_hash, nickname, created_at, updated_at)
SELECT format('seed%s@seed.hyanghae.test', lpad(n::text, 2, '0')),
       'seed-not-a-real-hash',
       format('시드사용자%s', lpad(n::text, 2, '0')),
       now(),
       now()
FROM generate_series(1, 12) AS n;

-- ---------------------------------------------------------------------------
-- 5. 후기.
--
-- 작성 시각을 하루씩 벌려 둡니다. 배치가 후기를 최근 순으로 잘라 보내므로, 시각이 모두 같으면
-- 개수 제한에 걸렸을 때 어느 후기가 잘려 나갔는지 알 수 없습니다.
-- ---------------------------------------------------------------------------
INSERT INTO perfume_reviews (user_id, perfume_id, title, content, created_at, updated_at)
SELECT u.user_id,
       sp.perfume_id,
       sr.title,
       sr.content,
       now() - (sr.seq || ' days')::interval,
       now() - (sr.seq || ' days')::interval
FROM seed_reviews sr
JOIN seed_perfumes sp ON sp.slot = sr.slot
JOIN users u ON u.email = format('seed%s@seed.hyanghae.test', lpad(sr.seq::text, 2, '0'));

-- ---------------------------------------------------------------------------
-- 6. 적재 확인.
--
-- 후기 수가 어긋나면 배치의 정책 경계(최소 5건)를 확인할 수 없으므로 여기서 멈춥니다.
-- ---------------------------------------------------------------------------
DO $$
DECLARE
    expected CONSTANT INTEGER := 22;
    loaded   INTEGER;
    mismatch INTEGER;
BEGIN
    SELECT count(*) INTO loaded
    FROM perfume_reviews r
    JOIN users u ON u.user_id = r.user_id
    WHERE u.email LIKE '%@seed.hyanghae.test';
    IF loaded <> expected THEN
        RAISE EXCEPTION '후기 %건을 넣어야 하는데 %건입니다.', expected, loaded;
    END IF;

    SELECT count(*) INTO mismatch
    FROM (
        SELECT sp.slot, count(*) AS actual
        FROM perfume_reviews r
        JOIN seed_perfumes sp ON sp.perfume_id = r.perfume_id
        GROUP BY sp.slot
    ) d
    JOIN (VALUES (1, 6), (2, 12), (3, 4)) AS e(slot, expected) ON e.slot = d.slot
    WHERE d.actual <> e.expected;
    IF mismatch > 0 THEN
        RAISE EXCEPTION '자리별 후기 수가 기대와 다릅니다(%자리). 대상 향수에 시드가 아닌 후기가 이미 있을 수 있습니다.', mismatch;
    END IF;
END $$;

COMMIT;

-- 임시 테이블은 커밋과 함께 사라지므로 시드 사용자로 대상 향수를 다시 찾습니다.
-- 후기 수는 시드가 넣은 것만이 아니라 그 향수의 전체 후기 수입니다. 배치가 정책을 판단할 때
-- 보는 수가 그것입니다.
\echo ''
\echo '=== 적재 결과 ==='
WITH seeded AS (
    SELECT DISTINCT r.perfume_id
    FROM perfume_reviews r
    JOIN users u ON u.user_id = r.user_id
    WHERE u.email LIKE '%@seed.hyanghae.test'
)
SELECT p.perfume_id,
       p.name,
       count(r.id)      AS reviews,
       count(r.id) >= 5 AS keyword_target
FROM seeded s
JOIN perfumes p ON p.perfume_id = s.perfume_id
LEFT JOIN perfume_reviews r ON r.perfume_id = s.perfume_id
GROUP BY p.perfume_id, p.name
ORDER BY p.perfume_id;

\echo ''
\echo '배치를 켜고 실행하면 keyword_target 이 t 인 향수만 키워드가 생깁니다.'
\echo '확인: GET /api/v1/perfumes/{perfumeId}/review-keywords?size=3'
