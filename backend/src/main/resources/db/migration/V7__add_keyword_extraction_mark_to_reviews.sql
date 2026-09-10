-- 후기의 키워드 추출 여부를 후기 자신이 기록합니다.
--
-- 지금까지는 perfume_review_summaries.source_review_count 가 "어디까지 처리했는가"를 들고
-- 있었습니다. 요약 문장을 만들지 않기로 하면서(화면이 상위 키워드로 문장을 구성합니다) 그 기록이
-- 사라졌고, 남은 근거는 perfume_review_keywords 의 행뿐입니다.
--
-- 그것만으로는 부족합니다. 향 표현이 없는 후기("선물로 받았어요")는 키워드가 0개라 행이 생기지
-- 않습니다. 행이 없으면 아직 처리하지 않은 것과 구분되지 않아, 그 후기를 매 주기 다시 AI 에게
-- 보냅니다. 실제 데이터에서 후기 16건 중 5건이 키워드 0개였습니다. 향수 200개로 늘면 매시간
-- 수백 번의 호출이 아무 결과 없이 나갑니다.
ALTER TABLE perfume_reviews
    ADD COLUMN keywords_extracted_at TIMESTAMPTZ;

-- 대상 조회는 "아직 추출하지 않은 후기"만 찾습니다. 부분 인덱스라 추출이 끝난 후기는 인덱스에서
-- 빠지고, 시간이 갈수록 인덱스가 작아집니다. 전체 인덱스를 걸면 처리된 후기까지 계속 담습니다.
CREATE INDEX idx_perfume_reviews_keywords_pending
    ON perfume_reviews (perfume_id)
    WHERE keywords_extracted_at IS NULL;

-- 프롬프트나 모델을 바꿔 전체를 다시 뽑아야 하면 이 컬럼을 NULL 로 되돌리고 키워드 행을 지웁니다.
--     DELETE FROM perfume_review_keywords;
--     UPDATE perfume_reviews SET keywords_extracted_at = NULL;
