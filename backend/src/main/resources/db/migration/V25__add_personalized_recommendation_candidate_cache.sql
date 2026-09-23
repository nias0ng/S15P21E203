CREATE TABLE personalized_recommendation_cache_states (
    user_id                   BIGINT      PRIMARY KEY,
    source_version            BIGINT      NOT NULL DEFAULT 0,
    calculated_source_version BIGINT,
    last_view_id              BIGINT      NOT NULL DEFAULT 0,
    calculated_at             TIMESTAMPTZ,
    result_status             VARCHAR(10),
    CONSTRAINT fk_personalized_recommendation_cache_states_user
        FOREIGN KEY (user_id) REFERENCES users (user_id) ON DELETE CASCADE,
    CONSTRAINT ck_personalized_recommendation_cache_states_version
        CHECK (source_version >= 0 AND last_view_id >= 0),
    CONSTRAINT ck_personalized_recommendation_cache_states_status
        CHECK (result_status IS NULL OR result_status IN ('READY', 'EMPTY'))
);

CREATE TABLE personalized_recommendation_candidates (
    user_id         BIGINT           NOT NULL,
    perfume_id      BIGINT           NOT NULL,
    candidate_rank  SMALLINT         NOT NULL,
    score           DOUBLE PRECISION NOT NULL,
    evidence_source VARCHAR(10)      NOT NULL,
    evidence_name   VARCHAR(255)     NOT NULL,
    PRIMARY KEY (user_id, perfume_id),
    CONSTRAINT uk_personalized_recommendation_candidates_rank
        UNIQUE (user_id, candidate_rank),
    CONSTRAINT fk_personalized_recommendation_candidates_state
        FOREIGN KEY (user_id)
        REFERENCES personalized_recommendation_cache_states (user_id) ON DELETE CASCADE,
    CONSTRAINT fk_personalized_recommendation_candidates_perfume
        FOREIGN KEY (perfume_id) REFERENCES perfumes (perfume_id) ON DELETE CASCADE,
    CONSTRAINT ck_personalized_recommendation_candidates_rank
        CHECK (candidate_rank BETWEEN 1 AND 10),
    CONSTRAINT ck_personalized_recommendation_candidates_score
        CHECK (score > 0.0)
);

CREATE TABLE personalized_recommendation_offers (
    recommendation_token UUID        PRIMARY KEY,
    user_id              BIGINT      NOT NULL,
    perfume_id           BIGINT      NOT NULL,
    issued_at            TIMESTAMPTZ NOT NULL,
    expires_at           TIMESTAMPTZ NOT NULL,
    CONSTRAINT fk_personalized_recommendation_offers_user
        FOREIGN KEY (user_id) REFERENCES users (user_id) ON DELETE CASCADE,
    CONSTRAINT fk_personalized_recommendation_offers_perfume
        FOREIGN KEY (perfume_id) REFERENCES perfumes (perfume_id) ON DELETE CASCADE,
    CONSTRAINT ck_personalized_recommendation_offers_expiry
        CHECK (expires_at > issued_at)
);

CREATE INDEX idx_personalized_recommendation_offers_user_expiry
    ON personalized_recommendation_offers (user_id, expires_at);

ALTER TABLE personalized_recommendation_exposures
    ADD COLUMN recommendation_token UUID;

CREATE UNIQUE INDEX uk_personalized_recommendation_exposures_token
    ON personalized_recommendation_exposures (recommendation_token)
    WHERE recommendation_token IS NOT NULL;

CREATE INDEX idx_user_perfume_views_user_id_cursor
    ON user_perfume_views (user_id, perfume_view_id);
