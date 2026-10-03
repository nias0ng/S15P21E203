-- 향 지도 밖 향수의 '비슷한 향수' 를 담습니다.
--
-- perfume_neighbors 는 향 지도 200개끼리만 계산된 2000행이라, 지도 밖 12.9만 개의 상세에서는
-- '비슷한 향수' 가 통째로 비었습니다 (지인 피드백 F3 · F16). 같은 공식으로 13만 개 전체를 미리
-- 계산해 이 표에 둡니다. 계산은 ai/build_similars.py, 적재는 backend/db/seed/load_perfume_similars.sh.
--
-- perfume_neighbors 를 늘리지 않고 표를 따로 둔 이유: 지도 200개의 이웃은 3D 지도가 그리는 선과
-- 같은 목록이어야 합니다(엔진 불변식 · frontend/landing/src/links.js). 후보를 13만 개로 넓히면 그
-- 200개의 이웃도 바뀌어 지도의 선과 서비스의 목록이 갈라집니다. 그래서 지도 향수는 지금처럼
-- perfume_neighbors 를 읽고, 거기 없는 향수만 이 표를 읽습니다.
--
-- 측정 (2026-10-01): 129,154개 향수 · 1,291,326행 · 향수당 최대 10개(못 채운 향수 48개) ·
-- similarity 0.3 이상 0.9 미만 (0.9 이상은 복제품이나 병만 바꿔 다시 낸 판으로 보고 넣지 않습니다.
-- 넷째 자리 반올림이라 0.9000 이 보일 수 있습니다).
-- 방향이 있는 관계입니다. a 의 목록에 b 가 있어도 b 의 목록에 a 가 없을 수 있습니다.
CREATE TABLE perfume_similars (
    perfume_id BIGINT NOT NULL,
    similar_perfume_id BIGINT NOT NULL,
    similarity NUMERIC(5, 4) NOT NULL,
    rank SMALLINT NOT NULL,
    PRIMARY KEY (perfume_id, similar_perfume_id),
    CONSTRAINT fk_perfume_similars_perfume
        FOREIGN KEY (perfume_id) REFERENCES perfumes (perfume_id) ON DELETE CASCADE,
    CONSTRAINT fk_perfume_similars_similar
        FOREIGN KEY (similar_perfume_id) REFERENCES perfumes (perfume_id) ON DELETE CASCADE,
    CONSTRAINT ck_perfume_similars_similarity
        CHECK (similarity > 0 AND similarity <= 1),
    CONSTRAINT ck_perfume_similars_rank
        CHECK (rank >= 1),
    CONSTRAINT ck_perfume_similars_not_self
        CHECK (perfume_id <> similar_perfume_id),
    -- 같은 향수 안에서 순서가 겹치면 size 로 자를 때 어느 쪽이 남을지 정해지지 않습니다
    CONSTRAINT uk_perfume_similars_rank UNIQUE (perfume_id, rank)
);

COMMENT ON TABLE perfume_similars IS
    '향 지도 밖 향수의 비슷한 향수. 지도 200개는 perfume_neighbors 를 씁니다';
COMMENT ON COLUMN perfume_similars.similarity IS
    '0.5 x 향 특성 코사인 + 0.5 x 노트 IDF 코사인 (향 지도와 같은 식)';
COMMENT ON COLUMN perfume_similars.rank IS '닮은 순서. 1 이 가장 닮았습니다';
