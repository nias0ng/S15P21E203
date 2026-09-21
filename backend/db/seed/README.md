# 데이터 적재

현재 서비스가 사용하는 기준 데이터와 화면 확인용 seed의 실행 방법을 설명합니다.
모든 명령은 별도 안내가 없으면 저장소 루트 또는 `backend/db/seed`에서 실행합니다.

## 적용 범위

| 데이터 | 규모 | 개발 | 운영 | 적재 도구 |
| --- | ---: | :---: | :---: | --- |
| 향 지도 | 향수 200개 | O | O | `load_scent_map.sql` |
| 향수 카탈로그 | 향수 129,161개 | O | O | `load_perfume_catalog.sh` |
| 브랜드 로고 | 로고 5,800개 | O | O | `load_perfume_catalog.sh` |
| 향수 카탈로그 보충 | 향수 152개 | O | O | `load_perfume_catalog_supplement.sh` |
| 향수 gender 보강 | 향수 129,113개 | O | O | `load_perfume_genders.sh` |
| 노트 메타데이터 | 노트 246개 | O | O | `load_notes.sh` |
| 향수 이미지 | 일반 129,154개·종이 질감 156개 | O | O | `load_perfume_images.sh` |
| 향수-노트 연결 | 906,133건 | O | O | `load_perfume_notes.sh` |
| 로컬 화면 테스트 데이터 | 사용자 활동 데이터 | O | X | `seed-local` |
| 운영 발표용 데모 데이터 | 발표 계정과 활동 데이터 | 선택 | 발표 환경만 | `run_demo_seed.sh` |
| 후기 테스트 seed | 후기 22건 | O | X | `load_review_seed.sql` |

기준 데이터는 서비스 기능이 직접 사용하므로 개발과 운영 DB에 모두 적용합니다. 로컬 화면 테스트
데이터와 후기 테스트 seed는 운영 DB에서 실행하지 않습니다.

## Seed 분류와 팀 공통 원칙

- Flyway는 테이블 구조와 계절처럼 모든 환경에 항상 필요한 소규모 고정값을 관리합니다.
- 기준 Seed는 외부 원본에서 받은 대용량 데이터를 관리하며 개발·운영에 같은 순서로 적용합니다.
- 보충 Seed는 주 원본의 제외 조건 때문에 빠졌지만 서비스 관계 데이터가 존재하는 항목만 별도로
  복원합니다. 주 카탈로그에 임의로 합치지 않고 제외 이유와 한계를 함께 기록합니다.
- 로컬·데모·후기 테스트 Seed는 사용자 활동을 만들기 위한 데이터이므로 운영에 적용하지 않습니다.
- 환경마다 달라지는 `perfume_id`를 파일에 고정하지 않고 `fragrantica_id`로 향수를 연결합니다.
- 모든 기준·보충 Seed는 재실행 가능해야 하며, 운영 적용 전 행 수와 외래키 연결을 검증합니다.

## 기준 데이터 적재 순서

1. 애플리케이션을 실행해 현재 Flyway 마이그레이션을 모두 적용합니다.
2. 향 지도 데이터를 적재합니다.
3. 향수 카탈로그를 적재합니다.
4. 향수 카탈로그 보충 데이터를 적재합니다.
5. 향수 gender 보강 데이터를 적재합니다.
6. 노트 메타데이터를 적재합니다.
7. 향수 이미지 메타데이터를 적재합니다.
8. 향수-노트 연결을 적재합니다.

각 적재 스크립트는 재실행할 수 있고 자체 트랜잭션으로 처리됩니다. 환경별로 달라지는
`perfume_id` 대신 `fragrantica_id`로 향수를 연결합니다.

### 로컬 기준 데이터 빠른 실행

프로젝트 루트에서 다음 명령을 실행하면 향 지도·카탈로그·카탈로그 보충·gender·노트·향수 이미지·
향수-노트 연결을 순서대로 적재합니다.

```powershell
docker compose -f compose.manual-test.yaml up -d --build --wait
docker compose -f compose.manual-test.yaml run --rm seed
```

## 운영 적용 전 확인

- S3 객체를 먼저 업로드하고 CloudFront URL이 열리는지 확인합니다.
- DB 비밀번호는 명령행에 직접 쓰지 않고 환경변수로 전달합니다.
- 후기 테스트 seed와 `seed-local`은 운영 DB에서 실행하지 않습니다.
- `fragrantica_id`가 없는 기존 향수는 카탈로그 적재 전에 확인합니다.

  ```sql
  SELECT perfume_id, name FROM perfumes WHERE fragrantica_id IS NULL;
  ```

- 향수 카탈로그는 약 100만 개의 향 특성 행을 한 트랜잭션으로 갱신하므로 서비스가 한가할 때
  실행합니다.

# 향 지도 데이터 적재

국내 대표 향수 200개의 좌표·향 계열·닮은 향수·향 특성을 적재합니다.

```bash
cd backend/db/seed
psql "$DATABASE_URL" -f load_scent_map.sql
```

정상 결과:

```text
 perfumes | map_points | scent_families | neighbors | perfume_accords | accords | regions_with_polygon
      200 |        200 |            303 |      2000 |            1598 |      60 |                    9
```

관련 CSV는 UTF-8(BOM)이며 향수를 `fragrantica_id`로 지목합니다. 닮은 향수는 방향이 있고,
향 계열 비중의 합은 1이 아닐 수 있습니다. `perfume_map_accords.csv`의 `strength`는 0~100이며
적재 시 0~1 범위의 `weight`로 변환합니다.

# 향수 카탈로그 적재

향수 129,161개, 브랜드 7,793개와 향 특성 1,000,570건을 적재합니다. 향 지도 향수와 겹치는
항목은 `fragrantica_id`로 갱신하고 나머지는 새로 생성합니다. `is_active`는 변경하지 않습니다.

```bash
cd backend/db/seed
./load_perfume_catalog.sh
```

접속 대상은 환경변수로 지정할 수 있습니다.

```bash
DATABASE_URL="postgresql://..." ./load_perfume_catalog.sh
DB_NAME=... DB_USER=... PG_CONTAINER=... ./load_perfume_catalog.sh
```

정상 기준:

```sql
SELECT (SELECT count(*) FROM brands)          AS brands,          -- 7,793 이상
       (SELECT count(*) FROM accords)         AS accords,         -- 92
       (SELECT count(*) FROM perfumes)        AS perfumes,        -- 129,161 이상
       (SELECT count(*) FROM perfume_accords) AS perfume_accords; -- 1,000,570

SELECT count(*) FILTER (WHERE NULLIF(btrim(gender), '') IS NULL) AS missing_gender,
       count(*) FILTER (WHERE upper(btrim(gender)) = 'FEMALE') AS female,
       count(*) FILTER (WHERE upper(btrim(gender)) = 'MALE') AS male,
       count(*) FILTER (WHERE upper(btrim(gender)) = 'UNISEX') AS unisex
FROM perfumes;
-- gender 보강 후 missing_gender = 0
```

한국어 향수명은 `perfume_ko.csv`, 브랜드 한국어명과 로고는 `brands_ko.csv`를 기준으로 갱신합니다.

## 향수 gender 보강

`perfume_genders.csv.gz`는 `fragrantica_id`, 원래 향수명, 브랜드명, `gender`를 담은 보강 원본입니다.
주 카탈로그의 향 지도 200개를 제외한 128,961개와 보충 카탈로그 152개를 합쳐 129,113개를
포함합니다. `load_perfume_genders.sh`는 카탈로그와 보충 카탈로그를 먼저 적재한 뒤 실행해야 합니다.

성별 값은 `FEMALE`, `MALE`, `UNISEX`로 정규화합니다. ID·이름·브랜드가 맞지 않거나 기존 값과
충돌하면 아무 행도 커밋하지 않고 중단하며, 빈 `gender`만 채웁니다. 따라서 재실행해도 안전합니다.

```bash
cd backend/db/seed
./load_perfume_genders.sh
```

## 브랜드 로고

브랜드 로고는 S3의 `brands/{slug}.png`에 저장하고 CloudFront로 제공합니다. 로컬 원본 5,803개 중
시드 URL로 사용하는 5,800개만 올립니다. `brand.png`, `kann.png`는 대응 브랜드가 없고,
`louis-phillippe-monaco.png`는 `Louis`의 정식 매핑 파일인 `louis.png`와 내용이 완전히 같은
중복 파일이므로 업로드와 시드에서 제외합니다. 실제 `Louis Philippe Monaco`는 철자가 다른
`louis-philippe-monaco.png`를 사용합니다.

```text
S3 키: brands/chanel.png
URL:    https://djpgc0m2v54q1.cloudfront.net/brands/chanel.png
```

로고 원본이 바뀌면 `generate_brand_logo_overrides.py`로 `brands_ko.csv`의 `logo_override`를 다시
만듭니다. 파일명 충돌은 CSV 순서에 따라 기본 슬러그와 `-2` 슬러그로 나누며, 생성기는 기대 개수와
미매칭 파일을 검증한 뒤에만 CSV를 교체합니다.

```bash
python generate_brand_logo_overrides.py /path/to/brand_logos
```

S3 업로드를 마친 뒤 향수 카탈로그 시드를 실행하면 기존 외부 로고 주소보다 CloudFront 주소가 우선
반영됩니다. 확인 쿼리는 다음과 같습니다.

```sql
SELECT count(*) AS cloudfront_brand_logos
FROM brands
WHERE logo_url LIKE 'https://djpgc0m2v54q1.cloudfront.net/brands/%.png';
```

# 향수 카탈로그 보충 데이터 적재

전체 Fragrantica 원본 131,930개 중 accord가 없는 2,769개는 자연어 추천용 주 카탈로그에서
제외됐습니다. 그중 노트 연결이 존재하는 향수 152개를 검색·상세·노트 조회가 가능하도록 별도로
적재합니다. ID·영문명·브랜드는 `perfume_notes.csv.gz`, 한국어명은 `perfume_ko.csv`에서
대조한 결과를 `perfume_catalog_supplement.csv`에 고정했습니다.

```bash
cd backend/db/seed
./load_perfume_catalog_supplement.sh
```

보충 데이터는 향수 152개와 필요한 신규 브랜드 5개를 생성합니다. 원본에 accord와 평가자 수가
없어 `perfume_accords`는 만들지 않고 `fragrantica_rating_count`는 기본값 0을 사용하므로, 이
향수들은 자연어 향 추천 대상이 아닙니다. 보충 향수의 원본 이미지는 모두 존재하지만 현재 이미지
Seed에는 포함하지 않으며, S3 업로드와 URL 검증을 마친 뒤 별도 반영합니다. 다른 수동 데이터가
없는 DB라면 주 카탈로그와 보충 데이터를 합쳐 향수는 129,313개가 됩니다.

정상 결과:

```text
 supplemental_perfumes | referenced_brands | pending_note_links
------------------------+-------------------+--------------------
                    152 |               131 |                591
```

# 노트 메타데이터 적재

노트 246개의 한국어명·분류·이미지 URL·인기 순위·설명을 적재합니다. `notes.csv`의 S3 이미지를
먼저 업로드해야 합니다.

```bash
cd backend/db/seed
./load_notes.sh
```

정상 결과:

```text
 loaded_notes | notes_with_image | ranked_notes
--------------+------------------+-------------
          246 |              246 |          246
```

기존 노트는 영문 `name`으로 갱신하고 `note_id`와 `is_active`를 유지합니다. 빈 설명은 기존 설명을
덮어쓰지 않습니다.

# 향수 이미지 적재

향수 129,154개의 일반 WebP 이미지와 156개의 종이 질감 PNG를 연결합니다.

| 타입 | 객체 키 | 표시 순서 |
| --- | --- | ---: |
| `ORIGINAL` | `perfumes/{fragrantica_id}/original.webp` | 1 |
| `PAPER_TEXTURE` | `perfumes/{fragrantica_id}/paper-texture.png` | 2 |

향수 카탈로그와 S3 업로드가 완료된 뒤 실행합니다.

```bash
cd backend/db/seed
./load_perfume_images.sh
```

정상 결과:

```text
 perfumes_with_images | original_images | paper_texture_images
-----------------------+-----------------+----------------------
               129154 |          129154 |                  156
```

이미지 URL은 `perfume_images.csv`에 있으며, 적재 스크립트가 객체 키·CloudFront URL·중복·카탈로그
연결 여부를 검증합니다.

일반 이미지 원본이 없는 향수의 `fragrantica_id`는 다음 7개입니다.

```text
86740, 111527, 112623, 113318, 120122, 133490, 133610
```

`perfume_id`는 DB 환경마다 새로 생성되므로 문서에 고정하지 않습니다. 적재된 환경에서의 번호와
향수명은 다음 쿼리로 확인합니다.

```sql
SELECT perfume_id, fragrantica_id, name
FROM perfumes
WHERE fragrantica_id IN (86740, 111527, 112623, 113318, 120122, 133490, 133610)
ORDER BY fragrantica_id;
```

# 향수-노트 연결 적재

향수와 노트를 잇는 905,542건을 적재합니다. 노트 메타데이터와 향수 카탈로그가 모두 먼저
적재돼 있어야 합니다.

```bash
cd backend/db/seed
./load_perfume_notes.sh
```

정상 결과:

```text
COPY 906133
INSERT 0 906133
NOTICE: 연결 906133건을 반영했습니다. 카탈로그에 없는 향수를 가리켜 건너뛴 행 0건.

 loaded_links | linked_notes | linked_perfumes
--------------+--------------+-----------------
       906133 |          246 |          127161
```

`perfume_notes.csv.gz`의 `perfume_id` 열은 DB PK가 아니라 `fragrantica_id`입니다. 스크립트가
향수명과 브랜드까지 대조합니다. 주 카탈로그에서 제외됐던 향수 152개는 보충 Seed가 먼저 생성하므로
591개 연결도 함께 적재됩니다.

# 로컬 화면 테스트 데이터

이미지가 있는 향수를 중심으로 사용자 43명의 보유·위시·조회·컬렉션·게시글·댓글·좋아요를
생성합니다. `SEED_ENV=manual-test`이고 DB 이름이 `_test`로 끝날 때만 실행됩니다.

```powershell
$env:SEED_LOGIN_PASSWORD = [System.Net.NetworkCredential]::new('', (Read-Host '테스트 계정 비밀번호' -AsSecureString)).Password
docker compose -f compose.manual-test.yaml run --build --rm seed-local
```

일반 실행은 사람이 수정한 seed 행을 유지하면서 누락된 행만 복원합니다. seed가 만든 데이터를
최초 값으로 되돌릴 때만 다음 명령을 사용합니다.

```powershell
docker compose -f compose.manual-test.yaml run --rm -e SEED_MODE=reset seed-local
```

수동으로 만든 데이터는 삭제하지 않습니다. 생성한 seed 행의 번호와 최초 값은 `local_seed`
스키마에서 관리하므로 이 스키마만 따로 삭제하지 마세요.

검증:

```powershell
cd backend
.\gradlew.bat test --tests com.hyanghae.seed.LocalSeedIntegrationTest
```

# 운영 발표용 데모 seed

정적 기준 데이터가 적재된 발표 환경에 데모 계정과 활동 데이터를 생성합니다. 실제 사용자 데이터는
수정하지 않으며 운영에서는 `fill`만 허용합니다.

```bash
export DEMO_SEED_CONFIRM=CREATE_DEMO_DATA
export DEMO_SEED_DOCKER_NETWORK=운영_Compose_네트워크명
export SEED_JDBC_URL='jdbc:postgresql://PostgreSQL서비스명:5432/운영DB이름'
export SEED_DB_USER='운영DB사용자'
export SEED_DB_PASSWORD='운영DB비밀번호'
export SEED_LOGIN_PASSWORD='발표용계정비밀번호'

bash backend/db/seed/run_demo_seed.sh
```

`demo01@demo.hyanghae.test`부터 `demo43@demo.hyanghae.test`까지 생성하며,
`demo41@demo.hyanghae.test`가 주요 발표 계정입니다.

# 후기 시드 적재

후기 요약 배치를 확인하기 위한 개발 전용 데이터입니다. 활성 향수 3개에 후기 6건·12건·4건을
연결하며 운영 DB에서는 실행하지 않습니다.

```bash
cd backend/db/seed
psql "$DATABASE_URL" -f load_review_seed.sql
```

대상 향수에 seed가 아닌 후기가 있거나 기대한 후기 수가 다르면 적재를 중단합니다.

# Seed 변경 과정

- 초기에는 향 지도 200개, 노트 246개와 일부 향수 이미지·후기 테스트 데이터를 제공했습니다.
- 전체 향수 카탈로그 129,161개와 향수-노트 연결 데이터를 추가해 서비스 기준 데이터를 완성했습니다.
- `S15P21E203-344`에서 일반 이미지를 129,154개의 WebP로 확대하고, 기존 종이 질감 PNG 156개를
  유지하도록 이미지 seed와 검증 규칙을 갱신했습니다. accord가 없어 주 카탈로그에서 제외됐지만
  노트 연결이 존재하는 향수 152개도 보충 Seed로 분리했습니다.
