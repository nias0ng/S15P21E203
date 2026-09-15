#!/usr/bin/env bash
#
# 향수 카탈로그 적재. load_perfume_catalog.sql 이 읽을 CSV 네 개를 한곳에 모은 뒤 psql 을 부릅니다.
#
# 실행 (이 디렉터리에서):
#     ./load_perfume_catalog.sh
#
# 두 가지를 대신해 줍니다.
#
#   1. ai/delivery/for_db 의 gzip 두 개를 풉니다. \copy 는 압축을 풀지 못합니다.
#   2. psql 이 로컬에 없으면 Docker 컨테이너 안에서 돌립니다. \copy 는 psql 이 도는 쪽의
#      파일을 읽으므로, 컨테이너에서 돌릴 때는 CSV 도 함께 넣어 줘야 합니다.
#
# 접속 정보는 compose.manual-test.yaml 의 기본값을 씁니다. 다르면 환경변수로 덮어쓰십시오.
#
#     DB_NAME=... DB_USER=... PG_CONTAINER=... ./load_perfume_catalog.sh
#
set -euo pipefail

# Git Bash(MSYS)가 /tmp 같은 인자를 Windows 경로로 바꿔 컨테이너 안 경로를 망칩니다.
# 리눅스·macOS 에서는 이 변수를 아무도 보지 않아 그냥 지나갑니다.
export MSYS_NO_PATHCONV=1
export MSYS2_ARG_CONV_EXCL='*'

DB_NAME="${DB_NAME:-hyanghae_test}"
DB_USER="${DB_USER:-hyanghae}"
PG_CONTAINER="${PG_CONTAINER:-hyanghae-manual-test-postgres-1}"

SEED_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DELIVERY_DIR="$SEED_DIR/../../../ai/delivery/for_db"

if [ ! -f "$DELIVERY_DIR/brands.csv" ]; then
    echo "적재 파일을 찾지 못했습니다: $DELIVERY_DIR" >&2
    exit 1
fi

STAGE_DIR="$(mktemp -d)"
trap 'rm -rf "$STAGE_DIR"' EXIT

echo "CSV 를 준비합니다..."
cp "$DELIVERY_DIR/brands.csv" "$DELIVERY_DIR/accords.csv" "$STAGE_DIR/"
gzip -dc "$DELIVERY_DIR/perfumes.csv.gz"        > "$STAGE_DIR/perfumes.csv"
gzip -dc "$DELIVERY_DIR/perfume_accords.csv.gz" > "$STAGE_DIR/perfume_accords.csv"
cp "$SEED_DIR/load_perfume_catalog.sql" "$STAGE_DIR/"

if command -v psql > /dev/null 2>&1; then
    echo "로컬 psql 로 적재합니다..."
    (cd "$STAGE_DIR" && psql "${DATABASE_URL:-postgresql://$DB_USER@localhost/$DB_NAME}" \
        -f load_perfume_catalog.sql)
else
    echo "로컬에 psql 이 없어 컨테이너($PG_CONTAINER)에서 적재합니다..."

    # docker 는 Windows 프로그램이라 호스트 쪽 경로만 Windows 표기로 바꿔 줍니다. 컨테이너 안
    # 경로는 위에서 막아 둔 대로 그대로 넘어갑니다.
    STAGE_HOST="$STAGE_DIR"
    if command -v cygpath > /dev/null 2>&1; then
        STAGE_HOST="$(cygpath -w "$STAGE_DIR")"
    fi

    docker exec "$PG_CONTAINER" rm -rf /tmp/perfume_catalog
    docker cp "$STAGE_HOST" "$PG_CONTAINER:/tmp/perfume_catalog"
    docker exec -w /tmp/perfume_catalog "$PG_CONTAINER" \
        psql -U "$DB_USER" -d "$DB_NAME" -f load_perfume_catalog.sql
    docker exec "$PG_CONTAINER" rm -rf /tmp/perfume_catalog
fi

echo "적재가 끝났습니다."
