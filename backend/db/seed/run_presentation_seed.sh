#!/usr/bin/env bash
# 기본 실행은 plan입니다. 운영 정리는 반드시 사전 백업/정지 후 replace로 명시합니다.
set -euo pipefail

mode="${SEED_MODE:-plan}"
case "$mode" in
  plan|verify|verify-summaries|replace|reset-actors) ;;
  *) echo 'SEED_MODE는 plan/verify/verify-summaries/replace/reset-actors 중 하나입니다.' >&2; exit 1 ;;
esac
for name in DEMO_SEED_DOCKER_NETWORK SEED_JDBC_URL SEED_DB_USER SEED_DB_PASSWORD; do
  if [ -z "${!name:-}" ]; then echo "$name 환경변수가 필요합니다." >&2; exit 1; fi
done

mounts=()
if [[ "$mode" == replace || "$mode" == reset-actors ]]; then
  for name in SEED_EXPECT_DATABASE SEED_LOGIN_PASSWORD PRESENTATION_SEED_CONFIRM; do
    if [ -z "${!name:-}" ]; then echo "$name 환경변수가 필요합니다." >&2; exit 1; fi
  done
  expected=RESET_DEMO_ACTORS
  if [[ "$mode" == replace ]]; then expected=REPLACE_ALL_ACTIVITY; fi
  if [[ "$PRESENTATION_SEED_CONFIRM" != "$expected" ]]; then
    echo "PRESENTATION_SEED_CONFIRM=$expected 확인값이 필요합니다." >&2; exit 1
  fi
fi
if [[ "$mode" == replace ]]; then
  if [[ ! -s "${SEED_BACKUP_FILE:-}" ]]; then echo '검증한 pg_dump -Fc 백업 경로가 필요합니다.' >&2; exit 1; fi
  backup="$(realpath "$SEED_BACKUP_FILE")"
  mounts=(--mount "type=bind,src=$backup,dst=/backup/database.dump,readonly")
fi

seed_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
backend_dir="$(cd "$seed_dir/../.." && pwd)"
image="${PRESENTATION_SEED_IMAGE:-hyanghae-presentation-seed:440}"
docker build --file "$seed_dir/Dockerfile.presentation" --tag "$image" "$backend_dir"
docker run --rm --network "$DEMO_SEED_DOCKER_NETWORK" "${mounts[@]}" \
  --env SEED_JDBC_URL --env SEED_DB_USER --env SEED_DB_PASSWORD \
  --env SEED_LOGIN_PASSWORD --env SEED_EXPECT_DATABASE --env PRESENTATION_SEED_CONFIRM \
  --env "SEED_MODE=$mode" --env SEED_BACKUP_FILE=/backup/database.dump "$image"
