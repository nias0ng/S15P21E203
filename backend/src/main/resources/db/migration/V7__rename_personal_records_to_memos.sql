ALTER TABLE personal_records
    RENAME TO memos;

ALTER TABLE memos
    RENAME COLUMN id TO memo_id;

ALTER TABLE memos
    DROP COLUMN tested_at;

ALTER TABLE memos
    RENAME CONSTRAINT personal_records_pkey TO memos_pkey;

ALTER TABLE memos
    RENAME CONSTRAINT fk_personal_records_user_perfume TO fk_memos_user_perfume;

ALTER TABLE memos
    RENAME CONSTRAINT uk_personal_records_user_perfume TO uk_memos_user_perfume;

ALTER SEQUENCE personal_records_id_seq
    RENAME TO memos_memo_id_seq;
