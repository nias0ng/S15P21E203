-- 단종이 확인된 향수를 표시합니다.
--
-- 추천에 단종 향수가 섞여, 지인이 "이거 불가리 단종 향수인데" 라고 짚었습니다(지인 피드백 F5).
-- 살 수 없는 향수를 권하면 추천 전체를 못 믿게 됩니다. 그래서 단종이 확인된 향수는 추천
-- (자연어 · 비슷한 향수 · 개인화)에서 빼고, 상세에는 '단종' 으로 적습니다.
--
-- is_active 를 내리지 않고 칸을 따로 둔 이유: is_active 가 false 면 검색 · 상세 · 진열대 담기 ·
-- 후기가 모두 막힙니다. 단종 향수도 이미 가진 사람은 진열대에 두고 후기를 써야 하고, 다른 사람은
-- 그 후기를 찾아 읽어야 합니다. 빼야 하는 곳은 '새로 권하는 자리' 뿐입니다.
--
-- 값은 ai/data/perfume_status.csv 에서 옵니다(load_perfume_status.sh). 그 파일의 '확정' 만 여기에
-- 들어옵니다. '추정'(브랜드 공식 판매 목록에서만 빠진 것)은 파일에만 두고 반영하지 않습니다 —
-- 아직 파는 향수를 잘못 빼는 쪽이 더 나쁘기 때문입니다.
--
-- 비어 있으면(NULL) '단종인지 모름' 입니다. 판매 중이라는 뜻이 아닙니다. 13만 개 전부를 판정하지
-- 않으므로 대부분의 향수가 이 상태입니다.
ALTER TABLE perfumes
    ADD COLUMN production_status VARCHAR(20),
    ADD COLUMN production_status_checked_at DATE,
    ADD COLUMN production_status_source VARCHAR(500);

ALTER TABLE perfumes
    ADD CONSTRAINT ck_perfumes_production_status
        CHECK (production_status IN ('DISCONTINUED'));

-- 단종이라고 적으려면 언제 무엇을 보고 그렇게 판정했는지가 함께 있어야 합니다. 화면이 출처와
-- 확인일을 같이 보여 주고, 다시 확인할 때 무엇부터 볼지도 이 두 칸이 알려 줍니다.
ALTER TABLE perfumes
    ADD CONSTRAINT ck_perfumes_production_status_evidence
        CHECK ((production_status IS NULL)
               = (production_status_checked_at IS NULL AND production_status_source IS NULL));

COMMENT ON COLUMN perfumes.production_status IS
    '확인된 생산 상태. DISCONTINUED 만 씁니다. NULL 은 모름이지 판매 중이 아닙니다';
COMMENT ON COLUMN perfumes.production_status_checked_at IS '생산 상태를 확인한 날';
COMMENT ON COLUMN perfumes.production_status_source IS '생산 상태의 근거 URL';
