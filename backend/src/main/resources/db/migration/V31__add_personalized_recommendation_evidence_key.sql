-- 개인화 추천 후보 캐시에 근거를 언어와 상관없이 가리키는 값을 함께 저장합니다.
--
-- evidence_name 은 화면에 그대로 쓰던 이름이라, 취향 테스트 근거(TASTE)는 향 계열의 한국어
-- 이름('우디')을 들고 있습니다. 영어 화면은 이 이름으로 계열을 알아볼 수 없으므로 계열 code
-- ('WOODY')를 evidence_key 로 둡니다. 적합도(FIT) · 최근 관심(RECENT) 근거는 어코드 이름이 이미
-- 언어와 상관없는 값(accords.name, 영어)이라 evidence_name 과 같은 값을 넣습니다.
--
-- 비워 둘 수 있게 둡니다. 배포가 겹치는 동안 이전 버전이 쓴 행은 이 칸이 비고, 읽는 쪽이
-- 계열 이름으로 code 를 찾아 채웁니다.
ALTER TABLE personalized_recommendation_candidates
    ADD COLUMN evidence_key VARCHAR(255);

-- scent_regions.name 은 유일(uk_scent_regions_name)하므로 이름 하나에 code 가 하나입니다.
UPDATE personalized_recommendation_candidates cached
SET evidence_key = CASE
        WHEN cached.evidence_source = 'TASTE' THEN (
            SELECT r.code
            FROM scent_regions r
            WHERE r.name = cached.evidence_name
        )
        ELSE cached.evidence_name
    END;

COMMENT ON COLUMN personalized_recommendation_candidates.evidence_key IS
    '근거의 언어 무관 키. TASTE 는 scent_regions.code, FIT · RECENT 는 accords.name';
