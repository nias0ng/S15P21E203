-- 샤넬 N°5 오 프르미에르(Fragrantica 1360)의 한국어 이름을 바로잡습니다.
--
-- V26 이 같은 교정을 하지만 `perfume_id = 23` 에 묶여 있습니다. perfume_id 는 시드를 적재한
-- 순서가 정하는 값이라 환경마다 다르고, 23 이 아닌 환경에서는 오류 없이 아무것도 하지 않아
-- 이름이 안 바뀐 채로 남습니다. 여기서는 번호 없이 fragrantica_id 로만 찾습니다 —
-- uk_perfumes_fragrantica_id 가 있어 한 행을 정확히 가리킵니다.
--
-- V26 을 고치지 않고 새로 두는 이유는, V26 이 이미 운영과 로컬 DB 에 적용돼 있어서입니다.
-- 적용된 파일을 바꾸면 체크섬이 달라져 Flyway 검증에서 백엔드가 뜨지 않습니다.
--
-- 이미 맞는 이름이면 건드리지 않습니다. 여러 번 돌려도 결과가 같습니다.
UPDATE perfumes
SET name_ko = '오 프르미에르'
WHERE fragrantica_id = 1360
  AND name_ko IS DISTINCT FROM '오 프르미에르';
