#!/usr/bin/env bash
#
# 노트 메타데이터 적재. 로컬 psql 이 있으면 직접 실행하고, 없으면 수동 테스트 PostgreSQL
# 컨테이너에 SQL 과 CSV 를 복사해 실행합니다.
#
# 실행 (이 디렉터리에서):
#     ./load_notes.sh
#
set -euo pipefail

export MSYS_NO_PATHCONV=1
export MSYS2_ARG_CONV_EXCL='*'

DB_NAME="${DB_NAME:-hyanghae_test}"
DB_USER="${DB_USER:-hyanghae}"
PG_CONTAINER="${PG_CONTAINER:-hyanghae-manual-test-postgres-1}"

SEED_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if [ ! -f "$SEED_DIR/notes.csv" ]; then
    echo "적재 파일을 찾지 못했습니다: $SEED_DIR/notes.csv" >&2
    exit 1
fi

if command -v psql > /dev/null 2>&1; then
    echo "로컬 psql 로 노트 메타데이터를 적재합니다..."
    (cd "$SEED_DIR" && psql "${DATABASE_URL:-postgresql://$DB_USER@localhost/$DB_NAME}" \
        -f load_notes.sql)
else
    echo "컨테이너($PG_CONTAINER)에서 노트 메타데이터를 적재합니다..."
    STAGE_DIR="$(mktemp -d)"
    trap 'rm -rf "$STAGE_DIR"' EXIT
    cp "$SEED_DIR/notes.csv" "$SEED_DIR/load_notes.sql" "$STAGE_DIR/"

    STAGE_HOST="$STAGE_DIR"
    if command -v cygpath > /dev/null 2>&1; then
        STAGE_HOST="$(cygpath -w "$STAGE_DIR")"
    fi

    docker exec "$PG_CONTAINER" rm -rf /tmp/note_seed
    docker cp "$STAGE_HOST" "$PG_CONTAINER:/tmp/note_seed"
    docker exec -w /tmp/note_seed "$PG_CONTAINER" \
        psql -U "$DB_USER" -d "$DB_NAME" -f load_notes.sql
    docker exec "$PG_CONTAINER" rm -rf /tmp/note_seed
fi

echo "노트 메타데이터 적재가 끝났습니다."
