UPDATE users
SET email = LOWER(BTRIM(email)),
    nickname = BTRIM(nickname),
    created_at = COALESCE(created_at, NOW()),
    updated_at = COALESCE(updated_at, created_at, NOW());

ALTER TABLE users
    ALTER COLUMN created_at SET DEFAULT NOW(),
    ALTER COLUMN created_at SET NOT NULL,
    ALTER COLUMN updated_at SET DEFAULT NOW(),
    ALTER COLUMN updated_at SET NOT NULL,
    ADD CONSTRAINT ck_users_email_normalized
        CHECK (email = LOWER(BTRIM(email))),
    ADD CONSTRAINT ck_users_nickname_trimmed
        CHECK (nickname = BTRIM(nickname));
