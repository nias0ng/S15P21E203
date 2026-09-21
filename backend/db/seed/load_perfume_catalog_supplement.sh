#!/usr/bin/env bash
# accord 없이 제외됐지만 노트 연결이 존재하는 향수 152개를 보충합니다.
set -euo pipefail

export MSYS_NO_PATHCONV=1
export MSYS2_ARG_CONV_EXCL='*'

DB_NAME="${DB_NAME:-hyanghae_test}"
DB_USER="${DB_USER:-hyanghae}"
PG_CONTAINER="${PG_CONTAINER:-hyanghae-manual-test-postgres-1}"
SEED_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if [ ! -f "$SEED_DIR/perfume_catalog_supplement.csv" ]; then
    echo "적재 파일을 찾지 못했습니다: $SEED_DIR/perfume_catalog_supplement.csv" >&2
    exit 1
fi

if command -v psql > /dev/null 2>&1; then
    echo "로컬 psql 로 보충 향수 카탈로그를 적재합니다..."
    (cd "$SEED_DIR" && psql "${DATABASE_URL:-postgresql://$DB_USER@localhost/$DB_NAME}" \
        -f load_perfume_catalog_supplement.sql)
else
    echo "컨테이너($PG_CONTAINER)에서 보충 향수 카탈로그를 적재합니다..."
    STAGE_DIR="$(mktemp -d)"
    trap 'rm -rf "$STAGE_DIR"' EXIT
    cp "$SEED_DIR/perfume_catalog_supplement.csv" \
       "$SEED_DIR/load_perfume_catalog_supplement.sql" "$STAGE_DIR/"

    STAGE_HOST="$STAGE_DIR"
    if command -v cygpath > /dev/null 2>&1; then
        STAGE_HOST="$(cygpath -w "$STAGE_DIR")"
    fi

    docker exec "$PG_CONTAINER" rm -rf /tmp/perfume_catalog_supplement
    docker cp "$STAGE_HOST" "$PG_CONTAINER:/tmp/perfume_catalog_supplement"
    docker exec -w /tmp/perfume_catalog_supplement "$PG_CONTAINER" \
        psql -U "$DB_USER" -d "$DB_NAME" -f load_perfume_catalog_supplement.sql
    docker exec "$PG_CONTAINER" rm -rf /tmp/perfume_catalog_supplement
fi

echo "보충 향수 카탈로그 적재가 끝났습니다."
