ALTER TABLE personal_records
    ALTER COLUMN user_perfume_id SET NOT NULL;

ALTER TABLE personal_records
    ADD CONSTRAINT uk_personal_records_user_perfume
        UNIQUE (user_perfume_id);
