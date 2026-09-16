# 데이터 적재

## 로컬 화면 테스트 데이터

기존 향수 데이터를 유지하면서 이미지가 있는 156개 향수 중심으로 사용자 활동을 채웁니다.
서버와 분리된 도구이며 운영 서버 JAR에는 포함되지 않습니다.

### 실행 명령

먼저 프로젝트 루트에서 기존 환경과 기준 데이터를 준비합니다. 이미 준비했다면 생략합니다.

```powershell
docker compose -f compose.manual-test.yaml up -d --build --wait
docker compose -f compose.manual-test.yaml run --rm seed
```

비밀번호를 숨겨서 입력한 뒤 활동 데이터를 넣습니다. 비밀번호는 8~64자, UTF-8 기준 72바이트
이하이며 저장소에 기록하지 않습니다.

```powershell
$env:SEED_LOGIN_PASSWORD = [System.Net.NetworkCredential]::new('', (Read-Host '테스트 계정 비밀번호' -AsSecureString)).Password
docker compose -f compose.manual-test.yaml run --build --rm seed-local
```

일반 실행은 기존 행을 수정하지 않고 빠진 seed 행을 복원합니다. 보유/위시가 3명 미만이면 아직
그 향수를 담지 않은 집계용 사용자로 보충합니다. 충분한 상태에서는 반복해도 행이 늘지 않습니다.

테스트하며 수정한 seed 데이터를 처음 값으로 되돌릴 때만 아래 명령을 사용합니다.

```powershell
docker compose -f compose.manual-test.yaml run --rm -e SEED_MODE=reset seed-local
```

예: seed가 만든 향수 A를 보유에서 위시로 바꿨다면, 초기화 후 다시 보유가 됩니다.
전체 DB 삭제가 아닙니다. 기존 seed 행은 같은 번호로 갱신하고 삭제된 행은 복원합니다.
사람이 새로 만든 글·댓글·컬렉션과 연결은 삭제하지 않습니다. 수동 데이터가 남으므로 전체 DB가
완전히 처음과 같아지는 것은 아닙니다. 기존 후기 seed는 초기화 대상이 아닙니다.

복원할 컬렉션 이름이나 대표 향수가 수동 데이터와 충돌하면 **활동 적재 전체를 취소**합니다.
충돌을 해결한 뒤 다시 실행하세요. 수동 데이터를 강제로 삭제하거나 seed 소유로 바꾸지 않습니다.
DB 전체를 지우는 `down -v`는 이 명령과 다르며 수동 데이터도 삭제합니다.

### 구성과 계정

| 항목 | 구성 |
| --- | --- |
| 향수 | 전체 카탈로그 유지, 이미지 manifest의 156개를 활동 대상으로 사용 |
| 보유·위시 | 대상마다 각각 최소 3명, 향수별 기록 수 차이와 동점 포함 |
| 조회 | 대상마다 1~30건 |
| 국내 선정 | 기존 200개 순위 유지 |
| 신규 테스트 사용자 | 43명 (`demo01`~`demo43`) |
| 활동 많은 사용자 | `demo41@demo.hyanghae.test`: 진열대 156개, 컬렉션 30개, 메모 52개 |
| 다른 사용자 | `demo42@demo.hyanghae.test`: 진열대 8개, 잡담 작성자 |
| 빈 사용자 | `demo43@demo.hyanghae.test`: 최초 생성 시 활동 없음 |
| 후기 | 보호 대상 외 향수마다 0~7건, 계절·좋아요 포함 |
| 커뮤니티 | 카테고리별 30개씩 총 90개, 컬렉션 공유·댓글·좋아요 포함 |

계정 비밀번호는 **처음 생성할 때 입력한 값**입니다. 일반 실행 시 다른 값을 입력해도 기존
비밀번호는 유지합니다. 초기화 시에는 장부에 기록된 최초 해시로 돌아갑니다.
인증 브랜치의 BCrypt 형식에 맞췄으며, 인증 MR이 `develop`에 병합되어 서버에 반영된 뒤 로그인할
수 있습니다. 이 도구가 임시 인증 기능을 추가하지는 않습니다.

기존 `load_review_seed.sql`은 해당 사용자가 없을 때 한 번 실행합니다. 이미 있으면 재실행하지
않습니다. 기존 향수 3개의 후기 **6·12·4건**을 보존하며 새 후기를 추가하지 않습니다. 새 사용자
도메인도 기존 `@seed.hyanghae.test`와 다릅니다. 기존 후기 수가 바뀌어 있으면 임의로 고치지 않고
중단하므로 해당 시나리오부터 확인하세요. 외부 AI 호출이나 가짜 분석 결과 생성은 하지 않습니다.

### 구현과 검증

- 앱 스키마는 기존 Flyway를 사용합니다. 생성 행의 번호와 최초 값은 별도 `local_seed` 스키마에
  기록하며 이 장부도 로컬 도구 전용 Flyway로 관리합니다. 운영 마이그레이션과 별개입니다.
- 장부만 지우면 생성 데이터의 소유 관계를 잃습니다. `local_seed`를 따로 삭제하지 마세요.
- 일반 실행은 사람이 수정한 seed 행도 유지합니다. 초기화는 그 수정 내용을 최초 값으로 되돌립니다.
- 쓰기 작업은 실행 중 잠시 대기하며 읽기는 가능합니다. 실패 시 활동 데이터 변경은 함께 롤백됩니다.
- `SEED_ENV=manual-test`이고 DB 이름이 `_test`로 끝날 때만 실행합니다.
- 생성 시각은 2026-09-01을 기준으로 고정합니다. 현재 순위는 전체 기간 집계입니다.
- 향수 선택에는 환경마다 달라지는 DB 번호 대신 CSV의 `fragrantica_id`를 사용합니다.
- 도구는 이미지의 DB 연결과 URL 존재를 검증합니다. 실제 CDN 접근은 별도 확인이 필요합니다.

백엔드를 직접 실행하는 경우에는 `backend`에서 다음 환경변수를 설정하고 Gradle로 실행합니다.
DB 접속 값은 본인의 로컬 환경에 맞게 바꾸세요.

```powershell
$env:SEED_ENV = 'manual-test'
$env:SEED_JDBC_URL = 'jdbc:postgresql://localhost:5432/hyanghae_test'
$env:SEED_DB_USER = 'hyanghae'
$env:SEED_DB_PASSWORD = [System.Net.NetworkCredential]::new('', (Read-Host '로컬 DB 비밀번호' -AsSecureString)).Password
$env:SEED_LOGIN_PASSWORD = [System.Net.NetworkCredential]::new('', (Read-Host '테스트 계정 비밀번호' -AsSecureString)).Password
$env:SEED_MODE = 'fill' # 초기화할 때만 reset
.\gradlew.bat seedLocal
```

검증: `.\gradlew.bat test --tests com.hyanghae.seed.LocalSeedIntegrationTest` (Docker 필요).
별도 Testcontainers DB를 사용하므로 개발 중인 DB는 변경하지 않습니다.

## 기준 데이터와 기존 후기 seed

- [향 지도 데이터](#향-지도-데이터-적재) — 향수 200개와 좌표·향 계열·닮은 향수·향 특성
- [노트 메타데이터](#노트-메타데이터-적재) — 노트 246개의 한국어명·분류·이미지·인기 순위
- [향수 이미지](#향수-이미지-적재) — 향 지도 향수 156개의 일반·종이 질감 이미지
- [향수 카탈로그](#향수-카탈로그-적재) — 향수 129,161개와 브랜드·향 특성. **운영에도 들어갑니다**
- [후기 시드](#후기-시드-적재) — 후기 요약 배치를 수동으로 확인할 때 쓰는 후기

다섯 가지의 성격이 다릅니다. 향 지도·노트 메타데이터·향수 이미지·향수 카탈로그는
**서비스가 실제로 쓰는 데이터**라 운영에도 들어가야 하고, 후기 시드는 **개발용 가짜 데이터**라
운영에서 돌리면 안 됩니다.

## 권장 실행 순서

새 데이터베이스를 구성할 때는 다음 순서를 사용합니다. 각 스크립트는 재실행할 수 있지만, 이미
적재된 대용량 향수 카탈로그를 배포할 때마다 실행할 필요는 없습니다.

| 순서 | 작업 | 실행 또는 확인 | 선행 조건 |
| ---: | --- | --- | --- |
| 1 | DB 스키마 적용 | 애플리케이션 실행으로 Flyway `V16`까지 적용 | PostgreSQL 실행 |
| 2 | 향 지도 데이터 | `load_scent_map.sql` | Flyway `V16` |
| 3 | 향수 카탈로그 | `./load_perfume_catalog.sh` | Flyway `V16`; 향 지도와 어느 쪽을 먼저 실행해도 되지만 향 지도를 먼저 권장 |
| 4 | 정적 이미지 업로드 | 노트 246개와 향수 312개를 S3에 업로드하고 CloudFront 접근 확인 | S3·CloudFront 구성 |
| 5 | 노트 메타데이터 | `./load_notes.sh` | Flyway `V15`, 노트 이미지 업로드 |
| 6 | 향수 이미지 | `./load_perfume_images.sh` | Flyway `V16`, 향 지도 데이터, 향수 이미지 업로드 |

노트 메타데이터는 향 지도나 향수 카탈로그에 의존하지 않지만, 깨진 이미지 URL을 먼저 DB에 넣지
않도록 S3 업로드 확인 뒤 실행합니다. 향수 이미지는 `fragrantica_id`와 향 지도 선정 순위를 함께
검증하므로 반드시 향 지도 데이터 뒤에 실행합니다.

후기 시드는 위 운영 순서에 포함하지 않습니다. 개발 환경에서 후기 요약 배치를 확인할 때만 향
지도 데이터 적재 후 별도로 실행합니다.

# 향 지도 데이터 적재

국내 대표 향수 200개의 향 지도 데이터입니다. 향수마다 지도 위 좌표가 있고, 어떤 향 계열에
속하는지, 어떤 향수와 닮았는지, 어떤 향 특성을 갖는지가 붙어 있습니다.

## 먼저 확인할 것

이 문서의 명령은 **모두 이 디렉터리(`backend/db/seed`)에서** 실행합니다. `\copy`가 CSV를
psql의 현재 디렉터리에서 찾기 때문입니다.

적재 전에 아래 두 가지가 끝나 있어야 합니다. **둘 다 저장소 루트에서** 하는 일입니다.

1. PostgreSQL 실행 — `docker compose -f compose.manual-test.yaml up -d postgres`
   ([compose 파일은 저장소 루트에 있습니다](../../../compose.manual-test.yaml))
2. 애플리케이션을 한 번 실행해 Flyway가 현재 스키마인 `V16`까지 적용

절차 전체는 [backend/README.md](../../README.md)의 "향 지도 초기 데이터 적재"에 있습니다.

## 실행

```bash
cd backend/db/seed

docker cp . hyanghae-manual-test-postgres-1:/tmp/seed
docker exec -w /tmp/seed hyanghae-manual-test-postgres-1 \
  psql -U hyanghae -d hyanghae_test -f load_scent_map.sql
```

컨테이너 안의 psql을 씁니다. 로컬에 psql이 설치돼 있지 않아도 되고, 접속 정보를 적을 필요도
없습니다. `docker cp .` 는 이 디렉터리의 내용을 컨테이너로 복사하며, 여러 번 실행해도 덮어쓰기만
합니다.

로컬에 `psql`이 설치돼 있다면 이 한 줄로도 됩니다.

```bash
psql "postgresql://hyanghae:hyanghae_test@localhost:5432/hyanghae_test" -f load_scent_map.sql
```

몇 번을 다시 돌려도 결과가 같습니다. 전체가 한 트랜잭션이라 중간에 하나라도 어긋나면 아무것도
반영되지 않습니다. 마지막에 적재된 행 수를 출력하니 아래와 같은지 확인하세요.

```
 perfumes | map_points | scent_families | neighbors | perfume_accords | accords | regions_with_polygon
      200 |        200 |            303 |      2000 |            1598 |      60 |                    9
```

## 파일

| 파일 | 행 | 내용 |
| --- | ---: | --- |
| `accords.csv` | 60 | 향 특성 이름 |
| `scent_families.csv` | 9 | 향 계열의 영역(폴리곤)과 라벨 위치 |
| `perfume_map_points.csv` | 200 | 향수 좌표와 국내 선정 순위 |
| `perfume_map_families.csv` | 303 | 향수 ↔ 향 계열 (향수당 1~3개) |
| `perfume_map_neighbors.csv` | 2000 | 닮은 향수 (향수당 10개) |
| `perfume_map_accords.csv` | 1598 | 향수의 향 특성 (향수당 7~8개) |

모두 UTF-8(BOM) CSV이고 향수를 `fragrantica_id`로 지목합니다. 스크립트가 `perfumes`와
조인해 `perfume_id`로 바꿔 넣습니다.

## 데이터를 다루기 전에 알아야 할 것

적재를 실패시키거나 데이터를 조용히 버리게 만드는 것들입니다. 스키마(`V6`)와 스크립트가 이미
반영하고 있지만, 조회 코드를 쓸 때도 같은 전제가 필요합니다.

- **향수 하나가 향 계열 여러 개에 걸쳐 있습니다.** 200개 중 1개가 105, 2개가 87, 3개가 8입니다.
  대표 계열은 따로 저장하지 않고 비중이 가장 큰 행으로 정합니다. 200개 전부 비중 1위가 동점이
  아니고 CSV의 `primary_family_key`와 일치하는 것을 확인했고, 스크립트가 적재할 때마다 다시
  확인합니다.
- **계열 비중의 합은 1이 아닙니다.** 향수별로 0.2~1.0입니다. 기준 미달인 계열이 빠진 뒤
  정규화하지 않았기 때문입니다. `1 - SUM(weight)`를 "기타 계열"로 읽으면 안 됩니다.
- **계열 비중의 최솟값은 0.24가 아니라 0.2입니다.** 계열을 뽑는 기준은 0.24지만 비중이 가장 큰
  계열은 기준에 못 미쳐도 반드시 넣습니다.
- **계열 영역의 좌표는 0~1을 벗어납니다.** 향수 좌표(x 0~1, y 0~0.83056)와 좌표계가 달라
  지도 바깥 여백까지 뻗어 있습니다(x -0.05~1.05, y -0.04565~0.88056). 0~1 제약은 향수 좌표에만
  걸어야 합니다.
- **닮은 향수는 방향이 있습니다.** 2000행 중 810행이 한쪽 방향뿐입니다. 순서 없는 쌍으로 접으면
  그만큼 사라집니다.
- **향 특성의 `strength`는 0~100이고 `perfume_accords.weight`는 0~1입니다.** 스크립트가
  100으로 나눠 넣습니다.

## 지도를 다시 만들면

향수 200개의 좌표와 계열 영역이 전부 바뀝니다. 일부만 바뀌는 일이 없으므로, CSV 6개를 새것으로
바꾸고 스크립트를 다시 돌리면 됩니다. 계열 9개의 구성이나 순서가 바뀐 경우에만 마이그레이션이
추가로 필요합니다.

## 아직 정하지 않은 것

- **향수별 계절·시간대 투표** — 데이터는 있지만(200개 중 185개·181개) 담을 표가 없어 이번
  CSV에서 뺐습니다. 쓰려면 표를 하나 더 만들어야 합니다.
- **지도 배경**(땅·바다·해안선) — 향수별 데이터가 아니라 지도를 128×108 칸으로 나눈 격자라
  DB에 넣지 않습니다. `scent_map_terrain.json`으로 따로 받아 정적 파일로 내려주기로 했는데
  아직 전달받지 못했습니다.

# 노트 메타데이터 적재

가장 많이 언급된 노트 246개의 한국어 이름, 대표 어코드 분류, CloudFront 이미지 주소와 인기
순위를 적재합니다. 서비스가 실제로 쓰는 마스터 데이터이므로 개발과 운영 DB에 모두 적용합니다.

## 먼저 확인할 것

- 애플리케이션을 한 번 실행해 Flyway `V15`까지 적용합니다.
- S3 버킷의 `notes/` 아래에 `notes.csv`의 이미지 246개를 먼저 업로드합니다. DB 적재 자체는
  이미지가 없어도 성공하지만 화면에서 깨진 주소를 반환하게 됩니다.
- `notes.csv`의 `popularity_rank`는 통계 순위이며 DB의 `note_id`가 아닙니다.

기존 노트는 유일한 영문 `name`으로 찾아 `note_id`와 `is_active`를 보존하고 표시 메타데이터만
갱신합니다. 없는 노트는 DB가 새 `note_id`를 자동 생성합니다. CSV에 없는 노트는 건드리지 않습니다.

## 실행

Git Bash 또는 Linux/macOS 셸에서 이 디렉터리로 이동해 실행합니다.

```bash
cd backend/db/seed
./load_notes.sh
```

로컬에 `psql`이 없으면 기본 수동 테스트 컨테이너인
`hyanghae-manual-test-postgres-1`에서 자동 실행합니다. 다른 환경은 다음 변수로 지정할 수 있습니다.

```bash
DB_NAME=hyanghae DB_USER=hyanghae PG_CONTAINER=postgres-container ./load_notes.sh
```

직접 `psql`을 사용할 때는 `notes.csv`와 `load_notes.sql`이 있는 이 디렉터리에서 실행합니다.

```bash
psql "$DATABASE_URL" -f load_notes.sql
```

정상 결과는 세 값이 모두 246입니다. 스크립트를 다시 실행해도 수가 늘어나지 않습니다.

```text
 loaded_notes | notes_with_image | ranked_notes
--------------+------------------+-------------
          246 |              246 |          246
```

# 향수 이미지 적재

향 지도 향수 200개 중 이미지가 준비된 156개에 일반 이미지와 종이 질감 이미지를 각각 한 장씩
연결합니다. 이미지 파일은 S3에, 메타데이터 312행은 `perfume_images` 테이블에 들어갑니다.

## 먼저 확인할 것

- 애플리케이션을 한 번 실행해 Flyway `V16`까지 적용합니다.
- [향 지도 데이터](#향-지도-데이터-적재)를 먼저 적재합니다. 이미지 CSV는 향 지도 순위와
  `fragrantica_id`가 모두 맞는 향수만 받으며, DB의 환경별 `perfume_id`를 직접 사용하지 않습니다.
- S3에 CSV의 `object_key` 경로로 이미지 312개를 올리고 CloudFront 접근을 확인합니다.

이미지 타입과 대표 이미지 순서는 다음과 같습니다.

| 타입 | 용도 | `display_order` |
| --- | --- | ---: |
| `ORIGINAL` | 검색·상세·지도·컬렉션의 대표 이미지 | 1 |
| `PAPER_TEXTURE` | 진열대용 종이 질감 이미지 | 2 |

기존 API는 표시 순서가 가장 빠른 이미지를 사용하므로 일반 이미지가 계속 대표로 반환됩니다.
종이 질감 이미지를 화면에서 사용하려면 후속 API 작업에서 타입별 조회를 추가해야 합니다.

## 실행

```bash
cd backend/db/seed
./load_perfume_images.sh
```

로컬 `psql`이 없으면 기본 수동 테스트 PostgreSQL 컨테이너에서 자동 실행합니다. 정상 결과는
각 이미지가 156개이며, 다시 실행해도 중복되지 않습니다.

```text
 perfumes_with_images | original_images | paper_texture_images
-----------------------+-----------------+----------------------
                  156 |             156 |                  156
```

# 향수 카탈로그 적재

자연어 추천이 쓰는 향수 129,161개입니다. 브랜드 7,793개와 향 특성 100만 행이 함께 들어갑니다.
데이터는 AI 쪽이 `ai/delivery/for_db/` 로 넘겨준 CSV 네 개이고, 만든 과정은
[ai/docs/perfume_load_handoff.md](../../../ai/docs/perfume_load_handoff.md) 에 있습니다.

향 지도 200개와 **겹칩니다.** 그 200개가 이 CSV 에 전부 들어 있어서, `fragrantica_id` 로 맞춰
이미 있으면 갱신하고 없으면 넣습니다. 두 번 만들면 지도가 가리키는 향수와 추천이 가리키는
향수가 갈립니다.

## 먼저 확인할 것

**스키마가 `V14` 까지 적용돼 있어야 합니다.** `V14` 가 `uk_perfumes_brand_name` 을 걷어내고
`fragrantica_rating_count` 를 만듭니다. 안 되어 있으면 향수를 넣는 단계에서 컬럼 이름을
알려주며 멈춥니다. 애플리케이션을 한 번 띄우면 Flyway 가 적용합니다.

## 실행

```bash
cd backend/db/seed
./load_perfume_catalog.sh
```

셸 스크립트가 두 가지를 대신합니다. 넘겨받은 CSV 둘이 gzip 이라 `\copy` 가 읽지 못해 풀어 주고,
로컬에 psql 이 없으면 컨테이너 안에서 돌립니다(`\copy` 는 psql 이 도는 쪽의 파일을 읽습니다).

접속 대상은 환경변수로 바꿉니다. 기본값은 `compose.manual-test.yaml` 의 것입니다.

```bash
DATABASE_URL="postgresql://..." ./load_perfume_catalog.sh   # 로컬에 psql 이 있을 때
DB_NAME=... DB_USER=... PG_CONTAINER=... ./load_perfume_catalog.sh
```

몇 번을 다시 돌려도 결과가 같습니다. 전체가 한 트랜잭션이라 중간에 하나라도 어긋나면 아무것도
반영되지 않습니다. 끝나면 아래와 같은지 확인하세요.

```sql
SELECT (SELECT count(*) FROM brands)          AS brands,          -- 7,793 이상
       (SELECT count(*) FROM accords)         AS accords,         -- 92
       (SELECT count(*) FROM perfumes)        AS perfumes,        -- 129,161 이상
       (SELECT count(*) FROM perfume_accords) AS perfume_accords; -- 1,000,570
```

`perfumes` 가 129,161 보다 클 수 있습니다. 이 CSV 에 없는 향수가 이미 있으면 그대로 남습니다.

## 운영에 넣기 전에

- **`fragrantica_id` 가 없는 향수를 먼저 보십시오.** 손으로 넣어 둔 향수가 카탈로그에도 있으면
  같은 이름이 두 줄로 남습니다. 적재가 만드는 중복이 아니라 짝지을 번호가 없어 생기는 일이고,
  어느 쪽이 진짜인지는 사람이 정해야 합니다.

  ```sql
  SELECT perfume_id, name FROM perfumes WHERE fragrantica_id IS NULL;
  ```

- **100만 행을 한 트랜잭션으로 넣습니다.** 로컬에서 9초 걸렸습니다. 운영 사양에 따라 더 걸릴 수
  있고 그동안 `perfume_accords` 에 잠금이 걸립니다. 서비스가 한가한 때를 고르십시오.
- **표가 커집니다.** 적재 뒤 `perfume_accords` 88MB · `perfumes` 18MB · `brands` 1.8MB 입니다.
- **건드리지 않는 값이 있습니다.** `name_ko` · `gender` · `description` · `concentration` 과
  `is_active` 는 이 CSV 에 없어 그대로 둡니다. 운영에서 내린 향수를 적재가 되살리지 않습니다.
- 마지막에 `ANALYZE` 를 돌립니다. 향수가 200개에서 13만 개로 늘어난 뒤 통계가 옛 크기를 들고
  있으면 조회가 인덱스를 건너뜁니다.

# 후기 시드 적재

후기 요약 배치([문서](../../docs/review-analysis-batch.md))는 후기가 쌓인 향수를 찾아
AI 로 요약을 만듭니다. 후기 작성 API 가 아직 없어서, 수동으로 확인하려면 후기를 직접 넣어야
합니다. `load_review_seed.sql` 이 그 일을 합니다.

향 지도 적재를 먼저 끝내야 합니다. 이 스크립트는 향수를 만들지 않고 **이미 있는 활성 향수 중
번호가 가장 작은 3개**에 후기를 붙입니다.

## 실행

```bash
cd backend/db/seed

docker cp . hyanghae-manual-test-postgres-1:/tmp/seed
docker exec -w /tmp/seed hyanghae-manual-test-postgres-1 \
  psql -U hyanghae -d hyanghae_test -f load_review_seed.sql
```

몇 번을 다시 돌려도 결과가 같습니다. 마지막에 아래처럼 출력됩니다. 향수 이름은 향 지도
데이터에 따라 다를 수 있습니다.

```
 perfume_id |             name             | reviews | summary_target
------------+------------------------------+---------+----------------
          1 | Orphéon Eau de Parfum        |       6 | t
          2 | Green Tea                    |      12 | t
          3 | Wood Sage & Sea Salt Cologne |       4 | f
```

## 무엇을 넣는가

후기 22건과 그 후기를 쓴 사용자 12명입니다. 향수마다 후기 수를 다르게 둔 이유는 배치의 최소
개수 정책(기본 5건)이 어디서 갈리는지 한 번의 실행으로 보이게 하려는 것입니다.

| 자리 | 후기 | 배치 대상 | 내용 |
| ---: | ---: | --- | --- |
| 1 | 6건 | 예 | 달콤·포근한 계열 |
| 2 | 12건 | 예 | 시트러스에서 우디로 넘어가는 계열 |
| 3 | 4건 | 아니오 | 묵직한 우디. 최소 개수에 하나 모자랍니다 |

1번 자리에는 일부러 두 종류의 후기를 섞었습니다.

- 배송·가격·용기 이야기가 섞인 후기 — 지시문이 향과 무관한 표현을 키워드로 뽑지 말라고 하는데,
  그 규칙이 실제로 지켜지는지 볼 수 있습니다.
- 향 표현이 아예 없는 후기 — 키워드가 빈 배열로 오는 경우입니다. 이 후기가 키워드 백분율의
  분모에서 빠지는 것까지가 정상입니다.

## 알아야 할 것

- **운영 데이터베이스에서 돌리지 마세요.** 사람이 쓴 후기와 섞이면 어느 것이 시드인지 구분되지
  않습니다. 구분 근거는 사용자의 이메일 도메인(`@seed.hyanghae.test`)뿐입니다.
- **시드 계정으로는 로그인할 수 없습니다.** `password_hash` 에 해시가 아닌 문자열을 넣어
  어떤 비밀번호도 맞지 않게 해 두었습니다.
- **대상 향수의 요약 행도 지웁니다.** 지금 배치는 요약을 만들지 않지만, 예전에 만들어졌거나 손으로
  넣어 둔 행이 남아 있으면 이제 존재하지 않는 후기로 만든 요약이 화면에 계속 보입니다.
- **대상 향수에 시드가 아닌 후기가 이미 있으면 적재가 중단됩니다.** 후기 수가 표와 달라지면
  정책 경계를 확인할 수 없기 때문입니다.
