#!/usr/bin/env bash
# perfumes_missing_gender.csv.gz를 카탈로그·보충 카탈로그 적재 뒤 perfumes.gender에 반영합니다.

set -euo pipefail

export MSYS_NO_PATHCONV=1
export MSYS2_ARG_CONV_EXCL='*'

DB_NAME="${DB_NAME:-hyanghae_test}"
DB_USER="${DB_USER:-hyanghae}"
PG_CONTAINER="${PG_CONTAINER:-hyanghae-manual-test-postgres-1}"

SEED_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DELIVERY_DIR="$SEED_DIR/../../../ai/delivery/for_db"

if [ ! -f "$DELIVERY_DIR/perfume_genders.csv.gz" ]; then
    echo "gender 적재 파일을 찾지 못했습니다: $DELIVERY_DIR/perfume_genders.csv.gz" >&2
    exit 1
fi

STAGE_DIR="$(mktemp -d)"
trap 'rm -rf "$STAGE_DIR"' EXIT

gzip -dc "$DELIVERY_DIR/perfume_genders.csv.gz" > "$STAGE_DIR/perfume_genders.csv"
cp "$SEED_DIR/load_perfume_genders.sql" "$STAGE_DIR/"

if command -v psql > /dev/null 2>&1; then
    (cd "$STAGE_DIR" && psql "${DATABASE_URL:-postgresql://$DB_USER@localhost/$DB_NAME}" \
        -f load_perfume_genders.sql)
else
    STAGE_HOST="$STAGE_DIR"
    if command -v cygpath > /dev/null 2>&1; then
        STAGE_HOST="$(cygpath -w "$STAGE_DIR")"
    fi
    docker exec "$PG_CONTAINER" rm -rf /tmp/perfume_genders
    docker cp "$STAGE_HOST" "$PG_CONTAINER:/tmp/perfume_genders"
    docker exec -w /tmp/perfume_genders "$PG_CONTAINER" \
        psql -U "$DB_USER" -d "$DB_NAME" -f load_perfume_genders.sql
    docker exec "$PG_CONTAINER" rm -rf /tmp/perfume_genders
fi

echo "gender 적재가 끝났습니다."
