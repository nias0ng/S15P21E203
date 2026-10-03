#!/usr/bin/env bash
#
# 향수 생산 상태(단종) 적재. ai/data/perfume_status.csv 를 psql 로 넣습니다.
#
# 실행 (이 디렉터리에서):
#     ./load_perfume_status.sh
#
# 두 가지를 대신해 줍니다.
#
#   1. ai/data 의 CSV 를 SQL 옆으로 옮깁니다. \copy 는 SQL 이 도는 자리에서 파일을 찾습니다.
#   2. psql 이 로컬에 없으면 Docker 컨테이너 안에서 돌립니다. \copy 는 psql 이 도는 쪽의
#      파일을 읽으므로, 컨테이너에서 돌릴 때는 CSV 도 함께 넣어 줘야 합니다.
#
# perfumes 가 먼저 채워져 있어야 합니다(load_perfume_catalog.sh). 비어 있으면 SQL 이 알려주며
# 멈춥니다. CSV 는 사람이 출처를 확인해 적는 파일입니다 (AI 엔진도 같은 파일을 읽습니다).
#
# 접속 정보는 compose.manual-test.yaml 의 기본값을 씁니다. 다르면 환경변수로 덮어쓰십시오.
#
#     DB_NAME=... DB_USER=... PG_CONTAINER=... ./load_perfume_status.sh
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
# AI 엔진과 같은 파일을 읽습니다 — 두 벌로 나누면 추천에서 빠지는 향수와 '단종' 으로 적히는 향수가 갈라집니다
STATUS_CSV="$SEED_DIR/../../../ai/data/perfume_status.csv"

if [ ! -f "$STATUS_CSV" ]; then
    echo "적재 파일을 찾지 못했습니다: $STATUS_CSV" >&2
    exit 1
fi

STAGE_DIR="$(mktemp -d)"
trap 'rm -rf "$STAGE_DIR"' EXIT

echo "CSV 를 준비합니다..."
cp "$STATUS_CSV" "$STAGE_DIR/perfume_status.csv"
cp "$SEED_DIR/load_perfume_status.sql" "$STAGE_DIR/"

if command -v psql > /dev/null 2>&1; then
    echo "로컬 psql 로 향수 생산 상태(단종)를 적재합니다..."
    (cd "$STAGE_DIR" && psql "${DATABASE_URL:-postgresql://$DB_USER@localhost/$DB_NAME}" \
        -f load_perfume_status.sql)
else
    echo "로컬에 psql 이 없어 컨테이너($PG_CONTAINER)에서 적재합니다..."

    # docker 는 Windows 프로그램이라 호스트 쪽 경로만 Windows 표기로 바꿔 줍니다. 컨테이너 안
    # 경로는 위에서 막아 둔 대로 그대로 넘어갑니다.
    STAGE_HOST="$STAGE_DIR"
    if command -v cygpath > /dev/null 2>&1; then
        STAGE_HOST="$(cygpath -w "$STAGE_DIR")"
    fi

    docker exec "$PG_CONTAINER" rm -rf /tmp/perfume_status_seed
    docker cp "$STAGE_HOST" "$PG_CONTAINER:/tmp/perfume_status_seed"
    docker exec -w /tmp/perfume_status_seed "$PG_CONTAINER" \
        psql -U "$DB_USER" -d "$DB_NAME" -f load_perfume_status.sql
    docker exec "$PG_CONTAINER" rm -rf /tmp/perfume_status_seed
fi

echo "향수 생산 상태 적재가 끝났습니다."
