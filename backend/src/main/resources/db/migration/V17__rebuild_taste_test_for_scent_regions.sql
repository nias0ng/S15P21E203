-- 취향 테스트를 향 계열 기준으로 다시 세웁니다.
--
-- 회원가입 뒤 첫 로그인에 한 번만 치릅니다. 향 계열 아홉 개 중 1~2개를 순위를 매겨 고르면
-- 향 지도 위 향수 한 개가 뽑히고, 그 향수가 배의 첫 위치가 됩니다. 추천이 아무것도 모르는
-- 상태로 시작하지 않게 하려는 것입니다.
--
-- V1 이 만든 표는 notes(향료 원료) 기준입니다. 화면은 향 계열에서 고르고 지도도 향 계열로
-- 나뉘어 있어 지금 구조로는 고른 값을 담을 자리가 없습니다. 네 표 모두 0행이라 옮길 데이터가
-- 없어 갈아엎습니다.


-- 1. 한 사람이 한 번만 칩니다.
--
-- 지금은 제약이 없어 같은 회원의 응시가 여러 줄 쌓일 수 있습니다. 그러면 배의 첫 위치를 어느
-- 줄에서 읽어야 할지 표가 말해 주지 않습니다. 서버에서 세어 막는 대신 표에 적습니다 — 두
-- 요청이 동시에 들어와도 갈라지지 않습니다.
ALTER TABLE user_taste_tests
    ADD CONSTRAINT uk_user_taste_tests_user UNIQUE (user_id);


-- 2. 결과를 향수로 남깁니다.
--
-- taste_result 는 VARCHAR(30) 이라 향수를 가리킬 수 없고, 무엇을 담을 칸인지도 정해진 적이
-- 없습니다. 0행이므로 지웁니다.
--
-- 참조 대상은 perfumes 입니다. perfume_map_points 가 아닙니다.
--
-- "결과는 지도에 있는 향수" 를 표로 막고 싶어 한때 perfume_map_points 를 가리켰는데, 그렇게
-- 두면 지도를 다시 적재할 때마다 모든 회원의 결과 향수가 비워집니다. load_scent_map.sql 이
-- 좌표를 지우고 다시 넣기 때문입니다. 같은 향수 200개가 그대로 돌아와도 ON DELETE SET NULL 이
-- 먼저 걸립니다. 바뀐 것이 없는데 전원의 배 출발점이 사라집니다.
--
-- 지도에 있다는 것은 쓰는 순간의 조건이지 계속 참인 성질이 아닙니다. 지도는 다시 만들어지고
-- 향수는 들고 납니다. 계속 참이어야 하는 것에 거는 제약으로는 맞지 않아, 그 확인은 저장할 때
-- TasteTestService 가 합니다 — 좌표가 없거나 내려간 향수면 400 입니다.
--
-- 비워 둘 수 있습니다. 향수가 정말로 지워지면 ON DELETE SET NULL 로 이 칸만 비고 응시 기록은
-- 남습니다. 기록이 사라지면 그 회원이 테스트를 다시 치러야 하는데, 한 번만 친다는 약속과
-- 어긋납니다. 고른 계열은 3번 표에 남아 있으므로 첫 위치는 다시 구할 수 있습니다.
ALTER TABLE user_taste_tests
    DROP COLUMN taste_result;

ALTER TABLE user_taste_tests
    ADD COLUMN matched_perfume_id BIGINT;

ALTER TABLE user_taste_tests
    ADD CONSTRAINT fk_user_taste_tests_matched_perfume
        FOREIGN KEY (matched_perfume_id) REFERENCES perfumes (perfume_id)
        ON DELETE SET NULL;


-- 3. 고른 계열을 순위와 함께 남깁니다.
--
-- 결과 향수만 남기면 신호가 줄어듭니다. 아홉 계열 중 둘을 골랐다는 사실이 향수 한 개로 접히고,
-- 그마저 매칭 규칙을 한 번 거친 값입니다. 콜드 스타트를 막으려고 모으는 데이터가 정작 고른
-- 내용인데 그것이 남지 않습니다.
--
-- 순위가 필요합니다. 화면이 1순위 0.58 · 2순위 0.42 로 가중치를 나눠 쓰므로 순서가 뒤집히면
-- 다른 향수가 뽑힙니다. 한 개만 고를 수도 있어 pick_order 는 1 또는 2 입니다.
--
-- 기본키가 (user_test_id, scent_region_id) 라 같은 계열을 1순위와 2순위로 겹쳐 고를 수 없고,
-- uk_user_taste_test_selections_order 가 한 응시에서 같은 순위가 두 번 나오는 것을 막습니다.
DROP TABLE user_taste_test_selections;
DROP TABLE taste_test_note_options;

CREATE TABLE user_taste_test_selections (
    user_test_id    BIGINT  NOT NULL,
    scent_region_id BIGINT  NOT NULL,
    pick_order      INTEGER NOT NULL,
    PRIMARY KEY (user_test_id, scent_region_id),
    CONSTRAINT uk_user_taste_test_selections_order
        UNIQUE (user_test_id, pick_order),
    CONSTRAINT ck_user_taste_test_selections_pick_order
        CHECK (pick_order IN (1, 2)),
    CONSTRAINT fk_user_taste_test_selections_test
        FOREIGN KEY (user_test_id) REFERENCES user_taste_tests (user_test_id) ON DELETE CASCADE,
    CONSTRAINT fk_user_taste_test_selections_scent_region
        FOREIGN KEY (scent_region_id) REFERENCES scent_regions (scent_region_id) ON DELETE RESTRICT
);
