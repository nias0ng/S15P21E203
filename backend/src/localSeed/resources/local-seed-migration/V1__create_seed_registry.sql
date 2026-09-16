-- public의 서비스 스키마와 분리된 로컬 도구 전용 장부입니다.
-- LocalSeed가 별도 Flyway history로 적용하며 서버/운영 마이그레이션에 포함되지 않습니다.
CREATE TABLE records (
    seed_key TEXT PRIMARY KEY,
    table_name TEXT NOT NULL,
    primary_key JSONB NOT NULL,
    baseline JSONB NOT NULL
);
