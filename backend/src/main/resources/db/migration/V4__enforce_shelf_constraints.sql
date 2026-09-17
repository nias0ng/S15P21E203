ALTER TABLE personal_records
    ALTER COLUMN user_perfume_id SET NOT NULL;

ALTER TABLE personal_records
    ADD CONSTRAINT uk_personal_records_user_perfume
        UNIQUE (user_perfume_id);

ALTER TABLE user_perfumes
    DROP COLUMN deleted_at;

ALTER TABLE user_perfumes
    ADD CONSTRAINT uk_user_perfumes_user_perfume
        UNIQUE (user_id, perfume_id);

CREATE UNIQUE INDEX uk_user_perfumes_representative_user
    ON user_perfumes (user_id)
    WHERE is_representative = TRUE;
