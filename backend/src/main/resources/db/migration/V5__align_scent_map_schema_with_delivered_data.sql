-- 향 지도 인계 데이터(CSV 6개)에 스키마를 맞춥니다.
--
-- V4 까지의 향 지도 스키마는 데이터를 받아 보기 전에 만든 것이라, 실제 CSV 와 어긋나는 곳이
-- 있었습니다. 아래 "측정" 은 인계받은 CSV 에서 직접 센 값입니다. 여기에 맞지 않게 만들면
-- 데이터가 들어가지 않거나 조용히 일부가 버려집니다.
--
-- 적재 스크립트는 backend/db/seed/load_scent_map.sql 입니다.

-- 1. 향 계열 코드를 적재 데이터의 키에 맞춥니다.
-- V4 는 GREEN_AROMATIC · AMBER_SPICY · MUSK_POWDERY 로 심었는데, CSV 의 family_key 는
-- GREEN · AMBER · MUSK 입니다. 그대로 두면 계열 3개가 조인되지 않아 향수-계열 303행 중
-- 100행(GREEN 39 + AMBER 24 + MUSK 37)이 적재에서 조용히 사라집니다.
--
-- 지우고 다시 넣지 않고 고쳐 쓰는 것은 scent_region_id 를 지키기 위해서입니다.
-- user_preference_regions 와 perfume_scent_families 가 이 번호를 참조합니다.
UPDATE scent_regions SET code = 'GREEN' WHERE code = 'GREEN_AROMATIC';
UPDATE scent_regions SET code = 'AMBER' WHERE code = 'AMBER_SPICY';
UPDATE scent_regions SET code = 'MUSK'  WHERE code = 'MUSK_POWDERY';

-- 2. 향 계열 영역은 사각형이 아닙니다.
-- min_x·min_y·max_x·max_y 는 영역을 사각형으로 가정한 컬럼입니다. 실제 계열 영역은 지도 위에
-- 불규칙하게 퍼져 있고 계열마다 조각이 1~5개라 사각형으로는 모양이 그려지지 않습니다.
-- 폴리곤을 두면서 사각형까지 남기면 같은 것을 두 벌로 갖게 되어 언젠가 어긋납니다. 읽는 코드가
-- 아직 없으므로 지웁니다.
ALTER TABLE scent_regions
    DROP COLUMN min_x,
    DROP COLUMN min_y,
    DROP COLUMN max_x,
    DROP COLUMN max_y;

-- polygon 은 조각들의 목록입니다. [[[x,y], ...], ...] 형태로 계열마다 조각이 1~5개이고,
-- 꼭짓점은 9개 계열을 합쳐 1692개(약 30KB)입니다.
-- anchor_x·anchor_y 는 계열 이름을 적을 위치입니다.
--
-- 이 좌표들에 0~1 CHECK 를 걸면 안 됩니다. 향수 좌표와 좌표계가 달라 지도 바깥 여백까지 뻗어
-- 있고, 측정값이 x -0.05~1.05, y -0.04565~0.88056 입니다. 제약을 걸면 계열 9개가 전부 적재에
-- 실패합니다. 0~1 은 향수 좌표에만 겁니다(아래 5).
--
-- 지도 배경(땅·바다·해안선)은 여기 넣지 않습니다. 향수별 데이터가 아니라 지도를 128x108 칸으로
-- 나눈 격자라 조회할 조건이 없습니다. 정적 파일로 프론트에 바로 내려줍니다.
ALTER TABLE scent_regions
    ADD COLUMN display_order INTEGER,
    ADD COLUMN anchor_x      DOUBLE PRECISION,
    ADD COLUMN anchor_y      DOUBLE PRECISION,
    ADD COLUMN polygon       JSONB;

-- display_order 는 지도 범례의 순서입니다. 계열 9개가 존재한다는 사실과 그 순서는 마이그레이션이
-- 정하고, 지도를 다시 만들 때마다 바뀌는 polygon·anchor 는 적재가 채웁니다.
UPDATE scent_regions SET display_order = v.display_order
FROM (VALUES
    ('CITRUS', 0), ('FRUITY', 1), ('FLORAL',   2),
    ('GREEN',  3), ('AQUATIC', 4), ('WOODY',   5),
    ('AMBER',  6), ('GOURMAND', 7), ('MUSK',   8)
) AS v(code, display_order)
WHERE scent_regions.code = v.code;

-- 3. 향수를 식별할 키.
-- 인계받은 CSV 6개가 전부 fragrantica_id 로 향수를 지목합니다. perfumes 에 이 값을 담을 곳이
-- 없으면 좌표·계열·이웃·어코드 어느 것도 붙일 수 없어 적재가 시작조차 되지 않습니다.
-- 브랜드명+향수명으로 맞추는 방법은 같은 향수가 농도 표기만 달라도 여러 줄이라 정확하지 않습니다.
--
-- 측정: 향수 200개의 값이 전부 다르고 최댓값이 132132 입니다. INTEGER 로도 들어가지만 외부
-- 시스템의 번호라 상한을 우리가 정할 수 없으므로 BIGINT 로 둡니다.
-- 이미 들어 있는 향수는 이 값을 모르므로 NOT NULL 을 걸지 않습니다.
ALTER TABLE perfumes ADD COLUMN fragrantica_id BIGINT;
ALTER TABLE perfumes ADD CONSTRAINT uk_perfumes_fragrantica_id UNIQUE (fragrantica_id);

-- 4. 적재 데이터가 향수와 함께 주는 값들. korea_selection_rank 는 V4 에서 이미 만들었습니다.
-- release_year: 측정 1978~2026. 200개 중 7개가 비어 있어 NOT NULL 을 걸지 않습니다.
-- korea_selection_basis: 측정 HWAHAE_MAP_READY_INCLUSION · PURCHASE_RRF_FILL 두 값이고
--   가장 긴 것이 26자입니다.
ALTER TABLE perfumes
    ADD COLUMN release_year          INTEGER,
    ADD COLUMN korea_selection_basis VARCHAR(30);

-- 5. 향수 좌표.
-- scent_region_id 는 대표 계열 하나를 담는 컬럼인데, 대표는 perfume_scent_families 에서 비중이
-- 가장 큰 행입니다. V4 가 "대표를 따로 저장하지 않는다" 고 정해 놓고 이 컬럼을 남겨 둬서, 적재가
-- 대표를 두 군데 넣어야 하는 상태였습니다. 두 군데에 두면 한쪽만 갱신됐을 때 조용히 어긋납니다.
--
-- 측정으로 확인한 것: 향수 200개 전부 비중 1위가 동점이 아니고, 비중 내림차순이 CSV 의 rank 와
-- 완전히 같으며, 1위 계열이 CSV 의 primary_family_key 와 200개 모두 일치합니다. 컬럼을 지워도
-- 잃는 정보가 없습니다.
ALTER TABLE perfume_map_points DROP COLUMN scent_region_id;

-- 좌표는 이 표의 존재 이유이므로 NOT NULL 입니다. CHECK 는 향수 좌표에만 겁니다(위 2 참고).
-- 측정: x 0~1, y 0~0.83056.
ALTER TABLE perfume_map_points
    ALTER COLUMN map_x SET NOT NULL,
    ALTER COLUMN map_y SET NOT NULL,
    ADD CONSTRAINT ck_perfume_map_points_coords
        CHECK (map_x >= 0 AND map_x <= 1 AND map_y >= 0 AND map_y <= 1);

-- 6. 향수별 계열 비중의 범위.
-- weight 제약을 >= 0.24 로 걸면 적재가 실패합니다. 계열을 뽑는 기준은 0.24 지만 비중이 가장 큰
-- 계열은 기준에 못 미쳐도 반드시 넣기 때문에 측정 최솟값이 0.2 입니다(최댓값 0.8224).
--
-- SUM(weight) = 1 제약은 걸면 안 됩니다. 기준 미달인 계열이 빠진 뒤 정규화하지 않아 향수별 합이
-- 측정 0.2~1.0 입니다. 같은 이유로 1 - SUM(weight) 를 "기타 계열" 로 읽어서도 안 됩니다.
ALTER TABLE perfume_scent_families
    ALTER COLUMN weight SET NOT NULL,
    ADD CONSTRAINT ck_perfume_scent_families_weight
        CHECK (weight > 0 AND weight <= 1);

-- 7. 주변·유사 향수의 유사도. 순서(rank)는 V4 에서 이미 만들었습니다.
-- 측정: 2000행, 향수당 정확히 10개, rank 1~10, similarity 0.2021~0.7797(소수 넷째 자리까지).
--
-- 방향이 있는 관계입니다. a 의 10위 안에 b 가 있어도 b 의 10위 안에 a 가 없을 수 있어 2000행 중
-- 810행이 한쪽 방향뿐입니다. (perfume_id, neighbor_perfume_id) 를 순서 없는 쌍으로 접으면
-- 이 810행이 사라지므로, 방향 있는 지금의 기본키를 그대로 둡니다.
--
-- 이미 들어 있는 행이 있을 수 있어 NOT NULL 은 걸지 않습니다. CHECK 는 NULL 을 통과시키므로
-- 값이 들어올 때만 범위를 봅니다.
ALTER TABLE perfume_neighbors ADD COLUMN similarity NUMERIC(5, 4);

ALTER TABLE perfume_neighbors
    ADD CONSTRAINT ck_perfume_neighbors_similarity
        CHECK (similarity > 0 AND similarity <= 1);

-- 8. 어코드 비중은 0~1 로 저장합니다.
-- 적재 CSV 의 strength 는 0~100 정수(측정 3~100)이고, perfume_accords.weight 는 API 가 이미
-- 0~1 비중으로 내려주고 있습니다. 적재에서 strength / 100 으로 바꿔 넣습니다.
-- CHECK 는 그 나눗셈을 빠뜨린 적재를 막습니다. 측정: 1598행, 향수당 7~8개, rank 1~8.
ALTER TABLE perfume_accords
    ADD CONSTRAINT ck_perfume_accords_weight
        CHECK (weight > 0 AND weight <= 1);
