# 핵심 API k6 부하 테스트

조회 4개와 쓰기 2개를 API별로 독립 측정합니다. 기본값은 안전한 smoke 모드(1 VU, 1회)입니다.
`MODE=load`일 때만 5, 10, 20, 30, 50 VU를 순서대로 실행합니다.

## 1. 준비

Windows에서 k6가 없으면 설치하고 새 PowerShell을 엽니다.

```powershell
winget install k6 --source winget
k6 version
```

로컬 서버와 seed를 준비합니다. 기존 seed 계정의 비밀번호를 알아야 합니다.

```powershell
$env:SEED_LOGIN_PASSWORD = [System.Net.NetworkCredential]::new('', (Read-Host '테스트 계정 비밀번호' -AsSecureString)).Password
docker compose -f compose.manual-test.yaml up -d --build --wait
docker compose -f compose.manual-test.yaml run --build --rm seed-local
```

스크립트는 비밀번호나 토큰을 파일에 저장하지 않습니다. 같은 PowerShell 창에서 다음 값을 둡니다.

```powershell
$env:BASE_URL = 'http://localhost:8080'
$env:TEST_USER_EMAIL = 'demo41@demo.hyanghae.test'
$env:TEST_PASSWORD = $env:SEED_LOGIN_PASSWORD
$env:PERFUME_ID = '3'
$env:REVIEW_ID = '1'
$env:SHELF_ITEM_ID = '사용자_진열대_항목_ID'
```

`PERFUME_ID`는 활성 향수, `REVIEW_ID`는 실제 존재하는 후기로 바꿉니다.

## 2. 로컬 smoke

저장소 루트에서 한 명령으로 여섯 스크립트를 실행합니다.

```powershell
.\performance\run-suite.ps1 -Mode smoke -BaseUrl 'http://localhost:8080'
```

개인화 추천이 400이면 해당 계정이 취향 테스트를 완료하지 않은 것입니다. 화면에서 테스트를 한 번
완료한 뒤 다시 실행합니다. 상태 코드 check와 `*_failure_rate`가 모두 성공이어야 운영 테스트로
넘어갑니다.

## 3. 운영 부하 테스트

운영에서는 반드시 부하 테스트 전용 계정을 사용합니다. 개인화 추천과 후기 좋아요는 50 VU에서
서로 다른 사용자 50명이 필요합니다. 다음 중 하나로 토큰을 전달합니다.

```powershell
# 이미 발급한 토큰 사용
$env:ACCESS_TOKENS = 'token1,token2,...,token50'

# 또는 같은 비밀번호를 쓰는 테스트 계정 이메일 사용
$env:TEST_USER_EMAILS = 'load01@example.com,load02@example.com,...,load50@example.com'
$env:TEST_PASSWORD = [System.Net.NetworkCredential]::new('', (Read-Host '부하 테스트 계정 비밀번호' -AsSecureString)).Password
```

운영 주소와 구간 시간을 지정합니다. 기본 구간 시간은 60초입니다.

```powershell
$env:BASE_URL = 'https://운영-API-주소'
$env:MODE = 'load'
$env:STAGE_SECONDS = '60'
```

한 번에 하나씩 직접 실행하거나, 전체 묶음을 실행합니다. 실제 측정에서는 API 사이에 서버 상태를
확인할 수 있도록 개별 실행을 권장합니다.

```powershell
k6 run performance/personalized-recommendation.js
k6 run performance/personalized-recommendation-same-user.js
k6 run performance/review-board-likes.js
k6 run performance/shelf-items.js
k6 run performance/shelf-item-detail.js
k6 run performance/perfume-view-create.js
k6 run performance/review-like.js

# 전체 묶음(기본 설정 기준 각 API 약 6분, 총 약 35분)
.\performance\run-suite.ps1 -Mode load -BaseUrl 'https://운영-API-주소' -StageSeconds 60
```

마지막 `K6 RESULT` 표의 `RPS`, `p95(ms)`, `error(%)`를 결과표에 옮깁니다. 중간에 보이는
Counter의 `rate`는 전체 실행 시간을 분모로 삼을 수 있으므로 VU별 RPS로 사용하지 않습니다.

후기 좋아요 테스트는 매번 실제 INSERT가 일어나도록 `DELETE unlike` 후 `PUT like`를 수행합니다.
따라서 결과표에는 **unlike + like 반복 부하에서 PUT like를 측정**했다고 기록합니다. 향수 조회 기록은
행을 계속 생성하므로 테스트 후 생성량을 확인하고 테스트 데이터 정리 정책에 따라 처리합니다.

### 개인화 후보 재사용 상태별 측정

개인화 추천은 아래 상태를 서로 섞지 않고 먼저 개별 측정합니다. 캐시 상태를 조작할 때는 반드시
부하 테스트 전용 사용자만 대상으로 하고, 운영 실행 전에는 별도 승인을 받습니다.

1. 후보 상태 행을 지운 뒤 첫 요청으로 최초 계산을 측정합니다.
2. 최초 계산이 성공한 사용자를 그대로 호출해 후보 재사용을 측정합니다.
3. 적합도를 실제로 바꾸거나 View 10건을 추가한 뒤 갱신 재계산을 측정합니다.
4. 유효 캐시 사용자와 갱신 대상 사용자의 토큰을 섞어 혼합 요청을 측정합니다.
5. 한 사용자 토큰만 전달하고 `personalized-recommendation-same-user.js`를 실행해 동시 계산과
   `RECOMMENDATION_REFRESH_IN_PROGRESS` 수를 측정합니다.

각 실행에서 p95·오류율·정상 200 처리량과 함께 Hikari active/pending/timeout, PostgreSQL CPU를
기록합니다. 409는 동일 사용자 계산 충돌을 의도적으로 즉시 돌려준 결과이므로 정상 추천 처리량과
분리해 해석합니다.

## 선택 환경변수

| 변수 | 기본값 | 설명 |
| --- | --- | --- |
| `MODE` | `smoke` | `smoke` 또는 `load` |
| `STAGE_SECONDS` | `60` | load의 각 VU 구간 시간(초) |
| `GRACE_SECONDS` | `10` | 진행 중 요청의 종료 대기 및 다음 구간까지 간격(초) |
| `THINK_TIME_SECONDS` | `0` | 반복 사이 대기 시간 |
| `PAGE_SIZE` | `20` | 후기·진열대 목록 크기 |
| `SHELF_CATEGORY` | `OWNED` | `OWNED`, `TRIED`, `WISH` |
| `SHELF_ITEM_IDS` | 없음 | 사용자 이메일 순서와 같은 개인 메모·상세용 진열대 항목 ID 목록 |
| `SHELF_ITEM_ID` | 없음 | smoke에서 한 사용자로 상세를 확인할 때 쓰는 단일 진열대 항목 ID |
| `VIEW_SOURCE` | `SEARCH` | 향수 상세 유입 경로 |
