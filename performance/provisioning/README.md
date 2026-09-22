# 운영 부하 테스트 데이터 준비

운영 DB에 직접 seed를 넣지 않고 서비스 API로 테스트 계정과 fixture를 준비합니다. PowerShell 7
이상이 필요합니다. 비밀번호와 Access Token은 파일에 저장하지 않습니다.

## 생성 범위

| 풀 | 생성 데이터 |
| --- | --- |
| `load-kim` | 사용자 50명, 9개 취향 방향, 취향 결과 지도 향수, 진열대, 적합도, 개인 메모 |
| `load-kwon` | 사용자 50명, 사용자별 수정용 게시글, 공용 좋아요 대상 게시글 |

`load-kwon` 게시글은 향수를 연결하지 않아 `trending-perfumes` 집계를 오염시키지 않습니다. 후기
집계 4종은 기존 운영 후기에서 최대 5개 향수를 찾아 manifest에 기록합니다. 자연어 추천은 비회원
API이며 IP 기준으로 제한되므로 사용자 fixture를 만들지 않습니다.

## 1. 계정 생성

운영 주소에는 실수를 막기 위해 `-AllowProduction`을 반드시 붙입니다.

```powershell
pwsh .\performance\provisioning\provision-load-users.ps1 `
  -BaseUrl 'https://운영-API-주소' `
  -Prefix 'load-kim' `
  -Count 50 `
  -AllowProduction

pwsh .\performance\provisioning\provision-load-users.ps1 `
  -BaseUrl 'https://운영-API-주소' `
  -Prefix 'load-kwon' `
  -Count 50 `
  -AllowProduction
```

기본 이메일은 `load-kim-01@loadtest.hyanghae.test` 형식입니다. 실제 수신 가능한 메일 주소는
필요하지 않지만 운영 인증 정책이 특정 도메인을 요구하면 `-Domain`으로 바꿉니다. 같은 명령을 다시
실행하면 기존 계정은 로그인으로 검증하고 누락된 계정만 생성합니다.

## 2. 경린 담당 fixture

```powershell
pwsh .\performance\provisioning\provision-kim-fixtures.ps1 `
  -BaseUrl 'https://운영-API-주소' `
  -AllowProduction
```

아홉 향 계열을 한 개씩 대표하는 프로파일을 순환 배정합니다. 각 프로파일의
`matchedPerfumeId`는 `/api/v1/map/scent-vectors` 응답에서 같은 코사인 유사도 규칙으로 자동
계산하므로 고른 계열과 지도 향수가 연결됩니다.

각 계정에는 기본 9개 진열대 항목을 `OWNED`, `TRIED`, `WISH`로 나누고, `OWNED`와 `TRIED`에는
적합도 평점을 넣습니다. 첫 `OWNED` 항목에는 개인 메모를 만듭니다.

## 3. 권 담당 fixture

일반 게시글 수정과 좋아요만 준비할 때:

```powershell
pwsh .\performance\provisioning\provision-kwon-fixtures.ps1 `
  -BaseUrl 'https://운영-API-주소' `
  -AllowProduction
```

S3 이미지 삭제 `afterCommit` 경로까지 시험할 때만 다음 옵션을 사용합니다. 계정마다 1픽셀 PNG를
업로드해 전용 게시글에 연결하므로, 운영 S3 객체가 50개 생성됩니다.

```powershell
pwsh .\performance\provisioning\provision-kwon-fixtures.ps1 `
  -BaseUrl 'https://운영-API-주소' `
  -WithImages `
  -AllowProduction
```

이미지 제거 PATCH는 게시글당 한 번만 유효합니다. 제목·내용 반복 수정 부하와 이미지 제거 부하는
서로 다른 k6 시나리오로 실행해야 합니다.

## 4. 검증

```powershell
pwsh .\performance\provisioning\verify-fixtures.ps1 `
  -UserManifestPath .\performance\provisioning\generated\load-kim.users.json `
  -FixtureManifestPath .\performance\provisioning\generated\load-kim.fixtures.json `
  -AllowProduction
```

권 계정은 경로의 `load-kim`을 `load-kwon`으로 바꿉니다. 검증은 로그인과 fixture 조회만 수행하고
추천 노출·조회 기록 같은 쓰기 데이터를 추가하지 않습니다.

## 5. k6로 전달할 값

생성된 manifest는 Git에서 제외됩니다. 이메일 목록은 다음처럼 현재 PowerShell 세션에 넣습니다.

```powershell
$manifest = Get-Content `
  .\performance\provisioning\generated\load-kim.users.json -Raw | ConvertFrom-Json
$env:TEST_USER_EMAILS = ($manifest.users.email -join ',')
$env:TEST_PASSWORD = [System.Net.NetworkCredential]::new(
  '',
  (Read-Host '부하 테스트 계정 비밀번호' -AsSecureString)
).Password

$fixtures = Get-Content `
  .\performance\provisioning\generated\load-kim.fixtures.json -Raw | ConvertFrom-Json
$env:SHELF_ITEM_IDS = ($fixtures.users.memoShelfItemId -join ',')
```

API별 ID는 fixture manifest에서 읽습니다.

- 경린: 사용자별 `matchedPerfumeId`, `memoShelfItemId`, `shelfItems`
- 권: `likeTargetPostId`, 사용자별 `postId`, `reviewAggregatePerfumeIds`

## 운영 주의사항

- 두 담당자의 실행 시간은 겹치지 않게 합니다.
- provisioning은 부하 테스트 전에 한 번만 실행하고, 직전에는 검증만 수행합니다.
- `-WithImages`는 S3 삭제 경로를 실제로 시험할 때만 사용합니다.
- 자연어 추천은 동일 출발 IP 전체가 같은 레이트리밋을 공유하므로 계정 50개로 제한을 우회할 수
  없습니다. 낮은 VU부터 별도 상한을 정합니다.
- 테스트 계정·게시글·S3 객체 제거는 생성과 분리된 승인된 정리 절차로 수행합니다.
