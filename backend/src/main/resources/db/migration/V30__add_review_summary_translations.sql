-- AI 후기 요약의 다른 언어판을 보관합니다. 지금은 영어(en)만 씁니다.
--
-- 번역은 배치로 미리 만들지 않습니다. 영어 화면이 그 향수의 요약을 처음 열 때 한국어 요약을
-- 옮겨 여기에 저장하고, 다음 요청부터는 저장본을 그대로 씁니다. 영어 화면이 한 번도 열지 않은
-- 향수는 번역 비용이 들지 않습니다.
--
-- source_updated_at 은 번역할 때 쓴 한국어 요약의 perfume_review_summaries.updated_at 입니다.
-- 배치가 한국어 요약을 다시 만들면 updated_at 이 바뀌어 두 값이 달라지고, 그때 다시 번역합니다.
-- 한국어 쪽과 같은 TIMESTAMPTZ 라 저장한 값을 그대로 비교할 수 있습니다.
--
-- 향수당 언어마다 한 건이라 (perfume_id, language) 가 기본키입니다. 같은 요약을 두 요청이 동시에
-- 번역해도 저장은 ON CONFLICT 로 한 행에 모입니다.
CREATE TABLE perfume_review_summary_translations (
    perfume_id BIGINT NOT NULL,
    language VARCHAR(8) NOT NULL,
    summary_text TEXT NOT NULL,
    source_updated_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT pk_perfume_review_summary_translations PRIMARY KEY (perfume_id, language),
    CONSTRAINT fk_perfume_review_summary_translations_perfume
        FOREIGN KEY (perfume_id) REFERENCES perfumes (perfume_id) ON DELETE CASCADE
);
