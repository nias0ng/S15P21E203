-- perfume_prices.price_range 를 min_price, max_price 로 나눕니다.
--
-- price_range 는 이름이 범위인데 NUMERIC 단일 컬럼이라 가격 범위를 담을 수 없었습니다.
-- 향수는 판매처와 시점에 따라 가격이 폭넓게 흩어지므로 최저·최고를 함께 보관합니다.
--
-- DROP COLUMN 이므로 price_range 에 들어 있던 값은 사라집니다. 가격 적재 파이프라인이
-- 아직 없어 이 컬럼은 비어 있는 상태입니다.
ALTER TABLE perfume_prices
    DROP COLUMN price_range,
    ADD COLUMN min_price NUMERIC(12, 2),
    ADD COLUMN max_price NUMERIC(12, 2);
