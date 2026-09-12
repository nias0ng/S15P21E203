-- 자유 게시판의 글 분류입니다.
--
-- 와이어프레임이 "분류는 컬렉션 공유 · 추천 · 잡담 셋 중 하나 — 필수" 로 정하고 있습니다.
-- 글을 쓰려면 posts.category_id 가 가리킬 행이 있어야 하는데 표가 비어 있어, 분류를 고르는 순간
-- 모든 작성이 실패합니다.
--
-- 시드가 아니라 마이그레이션으로 넣습니다. 분류 셋이 존재한다는 것은 기능의 일부라 어느 환경에서나
-- 같아야 하고, 시드를 돌리지 않은 곳(CI 포함)에서는 글쓰기가 통째로 막힙니다. 향 계열 9개를 V5 가
-- 같은 이유로 심었습니다.
--
-- code 는 화면이 쓰는 값이고 name 은 사람이 읽는 이름입니다. 화면의 분류 타입
-- (COLLECTION · RECOMMEND · CHAT)과 같은 낱말을 씁니다.
INSERT INTO post_categories (code, name, is_active) VALUES
    ('COLLECTION', '컬렉션 공유', TRUE),
    ('RECOMMEND',  '추천',      TRUE),
    ('CHAT',       '잡담',      TRUE);
