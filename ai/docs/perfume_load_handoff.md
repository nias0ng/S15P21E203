# 향수 129,161개 DB 적재 — 백엔드 인계

| | |
|---|---|
| 작성 | 2026-09-14 |
| 상태 | **파일 전달 완료.** 협의된 셋을 반영해 `ai/delivery/for_db/` 에 넣었습니다 |
| 대상 | 백엔드 · 인프라 |
| 관련 | `search_rules.md` (정렬 규칙) · `nlr_api_contract.md` (연동 형식) |

> **먼저 볼 것** — 넘긴 파일은 [넘기는 파일](#넘기는-파일) 절에 있습니다.
> 적재 순서와 주의사항은 [적재 순서](#적재-순서) 절입니다.

---

## 왜 넣습니까

자연어 추천은 **향수 129,161개 전체**에서 찾아 `fragranticaId` 를 돌려줍니다.
백엔드는 그 번호로 `perfumes` 를 조회해 이름·브랜드를 채워 화면에 보내야 하는데,
지금 DB 에는 **향 지도용 200개**뿐이라 대부분 찾지 못합니다.

실측 — 평가셋 600문장을 돌려 추천 결과가 DB 에 있는지 센 값입니다.

| | 지금 (200개) | 적재 후 (129,161개) |
|---|---|---|
| 향수가 한 개라도 뜨는 문장 | **36 / 600 (6.0%)** | 520 / 600 (86.7%) |
| 추천 칸 2,590개 중 채울 수 있는 것 | **61개 (2.4%)** | 전부 |

**지금 연동하면 화면의 94%가 빕니다.** 엔진이 틀려서가 아니라 DB 에 향수가 없어서입니다.

---

## 협의로 정해진 것 셋 — 2026-09-14

**정해진 대로 파일에 반영했습니다.**

| | 결정 | 파일에 어떻게 |
|---|---|---|
| 1 | **`people` 을 `perfumes` 에 컬럼으로 추가한다** | `perfumes.csv.gz` 에 `people` 열. 값 범위 **0 ~ 35,695** |
| 2 | **`rating_avg` 는 넣지 않는다** | 열을 만들지 않았습니다 |
| 3 | **`uk_perfumes_brand_name` 제약을 빼고 `UNIQUE (fragrantica_id)` 만 남긴다** | **129,161개가 전부 들어갑니다.** 겹치는 1,343행 포함 |

**3번이 마이그레이션을 요구합니다.** 제약을 빼기 전에 적재하면 1,343행에서 실패합니다.
아래는 각 결정의 배경입니다. 이미 합의된 내용이라 참고용입니다.

### 1. `people`(평가자 수)을 어디에 담습니까 — **필수입니다**

`perfumes` 에 평가자 수 컬럼이 없습니다. 그런데 **없으면 추천 순서를 재현할 수 없습니다.**

자연어 추천의 정렬 규칙입니다 (`search_rules.md`).

```
1순위  향 특성 세기의 합이 큰 순서       -> perfume_accords.weight 로 가능
2순위  동점이면 평가자 수가 많은 순서     -> 담을 곳이 없음
3순위  그래도 같으면 fragrantica_id 오름차순
```

2순위가 장식이 아닙니다. **평점으로 정렬하면 안 되기 때문에** 넣은 규칙입니다.

> 평점 5.00 인 향수 8,410개 중 **99.8% 가 평가자 10명 이하**입니다.
> 평점을 쓰면 평가자 1명짜리가 1위가 됩니다.

그리고 동점이 흔합니다. 조건이 넓을 때 **5위 자리를 두고 8,704개(중앙값)가 동점**입니다.
이 구간에서는 사실상 평가자 수가 순서를 정합니다. 값이 없으면 **아무거나 올라옵니다.**

| 선택지 | 비고 |
|---|---|
| `perfumes` 에 컬럼 추가 | 가장 단순합니다. 값 범위 0 ~ 35,695 (`INTEGER` 로 충분) |
| 별도 테이블로 분리 | 평점·리뷰 수 등이 더 붙을 예정이면 |

**협의 결과 `perfumes` 에 컬럼을 추가하기로 했고, 파일에 그대로 반영했습니다.**

### 2. `rating_avg`(평점)도 넣습니까

**추천 정렬에는 쓰지 않습니다.** 위 99.8% 때문에 일부러 뺐습니다.
다만 상세 화면에 평점을 보여줄 거면 필요합니다. 값 범위는 0 ~ 5 의 소수입니다.

### 3. `uk_perfumes_brand_name UNIQUE (brand_id, name)` 을 어떻게 합니까

**이 제약이 1,343행을 튕겨냅니다.** 적재가 중간에 실패합니다.

Fragrantica 에는 같은 브랜드가 같은 이름을 여러 번 씁니다. 농도(EDP/EDT)나 출시 연도만
다른 경우입니다.

```
4회  Michel Germain       | Tattoo
4회  Victoria's Secret    | Warm & Cozy
4회  ALREHAB PERFUMES     | Choco Musk
3회  El Nabil             | Musk Slim
3회  Balmain Beauty       | Vent Vert
```

| | 방법 | 대가 |
|---|---|---|
| **㉠** | **제약을 뺀다.** `UNIQUE (fragrantica_id)` 만 남긴다 | 129,161개가 전부 들어갑니다. **기존 제약을 바꾸는 것이라 다른 기능 영향을 확인해야 합니다** |
| ㉡ | 중복 1,343행을 버린다 | 127,818개만 들어갑니다. **추천에는 나오는데 DB 에 없는 향수가 생깁니다** |
| ㉢ | 이름에 구분자를 붙인다 (`Tattoo (2)`) | 전부 들어가지만 **사용자에게 이상한 이름이 보입니다** |

**AI 의견은 ㉠입니다.** `fragrantica_id` 가 이미 고유해서 향수를 특정할 수 있고,
"같은 브랜드의 같은 이름"은 향수 도메인에서 실제로 존재합니다.
다만 **그 제약을 왜 걸었는지는 백엔드가 아는 내용**이라 확인이 필요합니다.

---

## 넘길 데이터

원본은 `ai/data/perfumes_nlr.csv.gz` 입니다(5MB). 이걸 테이블별로 쪼개서 넘기겠습니다.

| 테이블 | 행 수 | 지금 DB 에 |
|---|---:|---|
| `brands` | **7,797** | 향 지도 브랜드 70개 |
| `accords` | **92** | **60개.** 32개가 빠져 있습니다 |
| `perfumes` | **129,161** | 200개 |
| `perfume_accords` | **1,000,570** | 1,597개 |

### `brands`

| 검사 | 결과 |
|---|---|
| 고유 브랜드 | 7,797개 |
| 이름 최대 길이 | 70자 (`VARCHAR(100)`) — **안전** |
| 빈 이름 | 0개 |

기존 브랜드와 **이름으로 맞춰야 합니다.** 향 지도 때 넣은 70개가 여기에도 있습니다.
같은 브랜드를 두 번 만들면 `perfumes.brand_id` 가 갈립니다.

### `accords` — **32개가 빠져 있습니다**

향 지도 인계 때 60개를 넘겼는데, 자연어 추천은 **92개 전부**를 씁니다.
다행히 **60개가 92개의 부분집합**이라 충돌 없이 32개만 추가하면 됩니다.

```
Champagne, Pear, alcohol, asphault, bacon, bbq, brown scotch tape, cannabis,
clay, foresty, gasoline, gourmand, hot iron, industrial glue, meat, milky,
oily, paper, plastic, rubber, sake, sand, savory, spice,
tennis ball, terpenic, varnish, vinyl, vodka, wet plaster, whiskey, wine
```

> **이름이 이상해 보이는 것은 오류가 아닙니다.** `asphault`(원본의 오타), `brown scotch tape`,
> `tennis ball` 은 **Fragrantica 가 실제로 쓰는 이름**입니다. 고치면 원본과 대조가 안 되므로
> 그대로 둡니다. 사용자에게 보여줄 한국어 이름은 별도 작업입니다.

이름 최대 길이 17자 (`VARCHAR(100)`) — 안전합니다.

### `perfumes`

| 검사 | 결과 |
|---|---|
| 행 수 | 129,161 |
| `fragrantica_id` 고유 | **129,161 / 129,161** — 전부 고유 |
| 이름 최대 길이 | 166자 (`VARCHAR(255)`) — **안전** |
| 빈 이름 | 0개 |
| `UNIQUE (brand_id, name)` | **1,343행 위반** — 위 3번 참고 |

**채우지 못하는 컬럼** — 원본에 없습니다. 비워 둡니다.

```
name_ko · gender · description · concentration
release_year · korea_selection_rank · korea_selection_basis
```

### `perfume_accords` — 100만 행입니다

원본 CSV 의 한 칸에 이렇게 들어 있습니다.

```
citrus:100|fresh spicy:47|green:41|sweet:33|aromatic:31|fruity:27|white floral:26|honey:16
```

**세기 내림차순으로 이미 정렬돼 있습니다**(129,161개 전부 확인). 그래서 순서가 곧 `rank` 입니다.

| 컬럼 | 넣을 값 |
|---|---|
| `rank` | 1부터. 위 예시면 citrus=1, fresh spicy=2 … |
| `weight` | 세기 그대로. **1 ~ 100 정수** |

향 지도 인계 때와 같은 형식입니다(`perfume_map_accords.csv` 의 `strength` 3~100, `rank` 1~8).

| 검사 | 결과 |
|---|---|
| 총 행 수 | **1,000,570** |
| 향수당 | 평균 7.7개 (최소 1 · 최대 8) |
| accord 가 0개인 향수 | 0개 |

> **적재 방법을 미리 정해 두시는 게 좋겠습니다.** 100만 행을 한 줄씩 INSERT 하면 오래 걸립니다.
> PostgreSQL 이므로 `COPY` 를 쓸 수 있습니다. 이건 백엔드 판단입니다.

---

## 이미 DB 에 있는 200개 — 새로 넣으면 안 됩니다

**향 지도용 200개가 CSV 에 전부 들어 있습니다**(200 / 200 확인).

그대로 INSERT 하면 `uk_perfumes_fragrantica_id` 에 걸려 실패하거나,
`fragrantica_id` 가 없는 다른 행으로 중복 생성됩니다.
**두 번 생기면 향 지도가 가리키는 향수와 추천이 가리키는 향수가 갈립니다.**

`fragrantica_id` 로 맞춰 **이미 있으면 갱신, 없으면 삽입**해야 합니다.
넘길 파일에 **어느 행이 기존 200개인지 표시해서** 드리겠습니다.

---

## 넘기는 파일

`ai/delivery/for_db/` 에 있습니다. 합쳐서 **6.45MB** 입니다.

| 파일 | 행 | 크기 | 열 |
|---|---:|---:|---|
| `brands.csv` | 7,797 | 0.11MB | `name` |
| `accords.csv` | 92 | 2KB | `name` · `is_new` |
| `perfumes.csv.gz` | 129,161 | 1.87MB | `fragrantica_id` · `name` · `brand_name` · `people` · `already_in_db` |
| `perfume_accords.csv.gz` | 1,000,570 | 4.47MB | `fragrantica_id` · `accord_name` · `rank` · `weight` |

**큰 둘만 gzip 입니다.** 안 하면 26MB 라 저장소에 넣기 부담스럽고, `ai/.gitignore` 의
`perfumes.csv` 규칙에 걸려 **조용히 빠집니다.** 작은 둘은 눈으로 열어볼 일이 많아 그대로 뒀습니다.

**`brand_id` · `accord_id` · `perfume_id` 는 비어 있습니다.** DB 가 만드는 번호라
AI 가 채우지 않습니다. **이름으로 이어 주십시오.** 향 지도 인계 때와 같은 방식입니다.

### 다시 만들려면

```bash
cd ai
python build_load_files.py
```

원본 `data/perfumes_nlr.csv.gz` 를 읽어 다시 만듭니다. **입력은 읽기만 합니다.**

---

## 적재 순서

외래키 때문에 순서가 있습니다. **거꾸로 하면 실패합니다.**

```
0. 마이그레이션   uk_perfumes_brand_name 제약 제거 + perfumes.people 컬럼 추가
       ↓
1. brands          이름으로 맞춰 없는 것만 추가          7,797개 (기존 70개 포함)
       ↓
2. accords         is_new = true 인 32개만 추가             32개
       ↓
3. perfumes        already_in_db = false 는 삽입        128,961개 삽입
                   already_in_db = true 는 갱신             200개 갱신
       ↓
4. perfume_accords 1,000,570행
```

**0번을 먼저 하지 않으면 3번에서 1,343행이 유니크 제약에 걸려 멈춥니다.**

### 3번을 특히 주의해 주십시오

**향 지도용 200개가 이 데이터에 전부 들어 있습니다**(200 / 200 확인).
그대로 INSERT 하면 `uk_perfumes_fragrantica_id` 에 걸리거나 중복 생성됩니다.

> **두 번 생기면 향 지도가 가리키는 향수와 추천이 가리키는 향수가 갈립니다.**
> 같은 향수인데 상세 페이지가 두 개가 됩니다.

`already_in_db` 열이 `true` 인 200행이 그것입니다. `fragrantica_id` 로 맞춰 **갱신**하십시오.

### 4번은 100만 행입니다

한 줄씩 INSERT 하면 오래 걸립니다. PostgreSQL 이므로 `COPY` 를 쓸 수 있습니다.
`.gz` 는 풀어서 넣으셔야 합니다. **적재 방법은 백엔드 판단입니다.**

---

## 적재가 끝나면 확인할 것

```sql
-- 1. 향수 수
SELECT count(*) FROM perfumes;                    -- 129,161

-- 2. 향 지도 200개가 두 번 생기지 않았는지
SELECT count(*) FROM perfumes WHERE fragrantica_id IN (...200개...);   -- 200

-- 3. accord 마스터
SELECT count(*) FROM accords;                     -- 92

-- 4. 향수당 accord 수
SELECT count(*) FROM perfume_accords;             -- 1,000,570

-- 5. 추천 1위가 실제로 조회되는지
SELECT perfume_id, name, brand_id FROM perfumes WHERE fragrantica_id = 73368;
-- Laundry / Ostrikov Beauty Publishing  (추천 예시 "빨래 냄새 나는 향수" 의 1위)
```

---

## 이 문서의 숫자에 대해

전부 `ai/data/perfumes_nlr.csv.gz` 를 실제로 읽어서 센 값입니다. 추정이 아닙니다.
커버리지 수치는 평가셋 600문장(향수 100개 × 문장 6개) 기준입니다.

**아직 재지 않은 것** — 적재에 걸리는 시간, 늘어나는 DB 용량, 적재 후 조회 성능.
이 셋은 DB 환경에 달려 있어 백엔드·인프라가 보실 몫입니다.
