-- 개인화 추천으로 실제 보여 준 향수를 남깁니다.
-- 같은 향수를 계속 보여 주지 않되 영구 제외하지 않기 위한 기록입니다.
CREATE TABLE personalized_recommendation_exposures (
    exposure_id    BIGSERIAL   PRIMARY KEY,
    user_id        BIGINT      NOT NULL,
    perfume_id     BIGINT      NOT NULL,
    recommended_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_personalized_recommendation_exposures_user
        FOREIGN KEY (user_id) REFERENCES users (user_id) ON DELETE CASCADE,
    CONSTRAINT fk_personalized_recommendation_exposures_perfume
        FOREIGN KEY (perfume_id) REFERENCES perfumes (perfume_id) ON DELETE CASCADE
);

-- 최근 3일 노출과 향수별 마지막 노출 시각을 사용자 단위로 찾습니다.
CREATE INDEX idx_personalized_recommendation_exposures_user_time
    ON personalized_recommendation_exposures (user_id, recommended_at DESC);

CREATE INDEX idx_personalized_recommendation_exposures_user_perfume_time
    ON personalized_recommendation_exposures (user_id, perfume_id, recommended_at DESC);

-- 최근 관심 어코드를 만들 때 사용자와 기간으로 조회합니다.
CREATE INDEX idx_user_perfume_views_user_viewed_at
    ON user_perfume_views (user_id, viewed_at DESC);
