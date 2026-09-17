#!/usr/bin/env bash
# 운영 발표 화면용 활동 데이터를 별도 도구로 보충합니다.
set -euo pipefail

required=(
  DEMO_SEED_CONFIRM
  DEMO_SEED_DOCKER_NETWORK
  SEED_JDBC_URL
  SEED_DB_USER
  SEED_DB_PASSWORD
  SEED_LOGIN_PASSWORD
)
for name in "${required[@]}"; do
  if [ -z "${!name:-}" ]; then
    echo "$name 환경변수가 필요합니다." >&2
    exit 1
  fi
done

if [ "$DEMO_SEED_CONFIRM" != "CREATE_DEMO_DATA" ]; then
  echo "DEMO_SEED_CONFIRM=CREATE_DEMO_DATA 확인값이 필요합니다." >&2
  exit 1
fi

SEED_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$(cd "$SEED_DIR/../.." && pwd)"
IMAGE_NAME="${DEMO_SEED_IMAGE:-hyanghae-demo-seed:latest}"

docker build --file "$SEED_DIR/Dockerfile.demo" --tag "$IMAGE_NAME" "$BACKEND_DIR"
docker run --rm \
  --network "$DEMO_SEED_DOCKER_NETWORK" \
  --env DEMO_SEED_CONFIRM \
  --env SEED_JDBC_URL \
  --env SEED_DB_USER \
  --env SEED_DB_PASSWORD \
  --env SEED_LOGIN_PASSWORD \
  --env SEED_MODE=fill \
  "$IMAGE_NAME"
