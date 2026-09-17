# 로컬에서 향해 실행하기

팀원이 자신의 PC에서 향해 화면을 열고 기능을 확인하기 위한 안내입니다.
**Windows PowerShell 기준**이며, 처음에는 1~4번을 순서대로 따라 하면 됩니다.

| 순서 | 하는 일 |
| --- | --- |
| 1 | 서버 켜기 |
| 2 | 향수·이미지 같은 기본 데이터 넣기 |
| 3 | 테스트 사용자·진열대·게시글 넣기 |
| 4 | 웹 화면 열기 |

## 이미 실행한 적이 있는 팀원: seed가 업데이트됐을 때

최신 코드를 받은 뒤 seed 관련 파일이 변경됐다면 아래 순서로 다시 실행합니다.
기존 DB를 삭제하지 않고 변경된 기본 데이터와 테스트 데이터를 반영합니다.
프로젝트를 처음 실행하는 팀원은 이 부분을 건너뛰고 아래 **시작 전에 준비할 것**부터 진행하세요.

### 1. 서버와 DB 구조 업데이트

```powershell
docker compose -f compose.manual-test.yaml up -d --build --wait
```

### 2. 향수·브랜드·노트 등 기본 데이터 업데이트

```powershell
docker compose -f compose.manual-test.yaml run --rm seed
```

### 3. 테스트 사용자·진열대·커뮤니티 데이터 업데이트

```powershell
$env:SEED_LOGIN_PASSWORD = [System.Net.NetworkCredential]::new('', (Read-Host '테스트 계정 비밀번호' -AsSecureString)).Password
docker compose -f compose.manual-test.yaml run --build --rm seed-local
```

`seed-local` 코드가 변경될 수 있으므로 `--build`를 붙여 실행합니다.

일반적인 seed 업데이트에는 아래 명령을 사용하지 않습니다.

```powershell
docker compose -f compose.manual-test.yaml down -v
```

이 명령은 직접 작성한 데이터를 포함해 로컬 DB 전체를 삭제합니다.

## 시작 전에 준비할 것

다음 프로그램이 필요합니다.

- **Git**: 프로젝트 코드를 내려받을 때 사용합니다.
- **Docker Desktop**: 서버와 데이터 저장소를 실행합니다.
- **Node.js 22.12 이상 / npm 10.9 이상**: 웹 화면을 실행합니다. npm은 Node.js 설치 시 함께 설치됩니다.

JDK나 IntelliJ는 **백엔드 코드를 직접 수정하는 팀원만** 필요합니다.
화면을 열어 테스트하는 경우에는 설치하지 않아도 됩니다.

### 프로젝트 폴더에서 PowerShell 열기

1. 파일 탐색기에서 프로젝트 폴더를 엽니다.
2. `compose.manual-test.yaml` 파일과 `backend`, `frontend`, `ai` 폴더가 보이는지 확인합니다.
3. 탐색기 위쪽 주소 표시줄에 `powershell`을 입력하고 Enter를 누릅니다.
4. 열린 창에 다음 명령을 입력합니다.

```powershell
Test-Path .\compose.manual-test.yaml
```

`True`가 나오면 올바른 위치입니다. `False`라면 2번의 파일이 보이는 폴더에서 다시 열어주세요.
이 문서에서 **프로젝트 폴더**는 이 위치를 뜻합니다.

## 1. 서버 켜기

Docker Desktop을 먼저 켜고 실행 준비가 끝날 때까지 기다립니다.
앞에서 연 PowerShell에 다음 명령을 입력합니다.

```powershell
docker compose -f compose.manual-test.yaml up -d --build --wait
```

처음에는 프로그램을 내려받고 준비하느라 몇 분 걸릴 수 있습니다.
명령이 끝나면 다음 명령으로 상태를 확인합니다.

```powershell
docker compose -f compose.manual-test.yaml ps
```

`postgres`, `redis`, `ai`, `backend`가 모두 `healthy`로 표시되면 준비된 상태입니다.

- `backend`: 화면의 요청을 처리하는 서버
- `postgres`: 사용자·향수·게시글 등을 저장하는 곳(DB)
- `redis`: 로그인 상태 등 빠르게 조회할 정보를 보관하는 곳
- `ai`: 자연어로 향수를 찾는 데 사용하는 서버

아직 웹 화면은 열리지 않습니다. 화면은 4번에서 실행합니다.

## 2. 기본 데이터 넣기

**같은 PowerShell 창**에서 실행합니다.

```powershell
docker compose -f compose.manual-test.yaml run --rm seed
```

향 지도, 향수 목록, 노트, 향수 이미지를 넣는 명령입니다.
마지막에 `모든 초기 데이터 적재가 끝났습니다`가 나오면 완료입니다.

이 명령만으로는 테스트 사용자나 진열대, 커뮤니티 게시글이 만들어지지 않습니다.
그 데이터는 다음 단계에서 넣습니다.

## 3. 테스트 사용자·진열대·게시글 넣기

미리 준비한 테스트 데이터를 **seed(시드)**라고 부릅니다.
이 단계는 직접 회원과 게시글을 하나씩 만들지 않아도 화면을 확인할 수 있도록 데이터를 준비합니다.

### 테스트 계정 비밀번호 입력

같은 PowerShell 창에 아래 줄을 입력합니다. 비밀번호를 물으면 사용할 값을 입력하고 Enter를 누릅니다.
입력 내용은 화면에 그대로 표시되지 않습니다.

```powershell
$env:SEED_LOGIN_PASSWORD = [System.Net.NetworkCredential]::new('', (Read-Host '테스트 계정 비밀번호' -AsSecureString)).Password
```

로컬 테스트용으로만 사용할 비밀번호를 정해주세요. 영문·숫자 기준 8~64자로 정하면 됩니다.

### 데이터 넣기

```powershell
docker compose -f compose.manual-test.yaml run --build --rm seed-local
```

`로컬 seed 완료`가 나오면 성공입니다. 기존 향수 목록은 유지하며,
**이미지가 있는 156개 향수 중심으로** 보유·위시·조회 기록과 후기를 넣습니다.
컬렉션, 게시글, 댓글, 좋아요도 함께 준비됩니다.

| 확인할 상황 | 테스트 계정 |
| --- | --- |
| 향수가 많이 담긴 진열대와 컬렉션 | `demo41@demo.hyanghae.test` |
| 다른 사용자의 글과 진열대 | `demo42@demo.hyanghae.test` |
| 처음 시작하는 빈 상태 | `demo43@demo.hyanghae.test` |

비밀번호는 **계정을 처음 만들 때 입력한 값**입니다.
일반 실행 때 다른 비밀번호를 입력해도 기존 계정의 비밀번호가 바뀌지는 않습니다.
빈 계정으로 직접 활동했다면 그 기록도 유지됩니다.

이 명령은 다시 실행해도 직접 만든 데이터를 유지하면서 빠진 테스트 데이터를 채웁니다.
테스트하며 수정한 seed 기록을 되돌리는 방법은 아래 **6번**에 따로 있습니다.

## 4. 웹 화면 열기

지금까지 사용한 PowerShell 창은 그대로 두고,
**프로젝트 폴더에서 PowerShell 창을 하나 더 엽니다.**
새 창에서 다음 명령을 한 줄씩 실행합니다.

```powershell
cd frontend
if (-not (Test-Path .env.local)) { Copy-Item .env.example .env.local }
npm ci
npm run dev
```

- 환경 설정 파일이 없을 때만 예시 파일을 복사합니다. 이미 설정한 파일은 유지됩니다.
- `npm ci`는 화면 실행에 필요한 프로그램을 설치합니다.
- `npm run dev`는 화면을 실행합니다. **이 창은 실행 중인 상태로 열어두세요.**

브라우저에서 [http://localhost:5173](http://localhost:5173)을 엽니다.
터미널의 `Local:`에 다른 주소가 나오면 그 주소를 사용하세요.

서버 상태를 확인할 때는 다음 주소도 사용할 수 있습니다.

- [서버 상태](http://localhost:8080/actuator/health)
- [API 확인 화면(Swagger)](http://localhost:8080/swagger-ui/index.html)

## 5. 다음 날 다시 켜거나 종료하기

### 다시 켜기

Docker Desktop을 켜고 **프로젝트 폴더**의 PowerShell에서 실행합니다.

```powershell
docker compose -f compose.manual-test.yaml up -d --wait
```

새 PowerShell 창을 프로젝트 폴더에서 열고 화면을 실행합니다.

```powershell
cd frontend
npm run dev
```

데이터를 지우지 않았다면 2번과 3번을 매번 다시 할 필요는 없습니다.
백엔드·AI 코드가 바뀌었다면 서버 실행 명령에 `--build`를 추가합니다.
화면 쪽 설치 목록이 바뀌었다면 `npm ci`를 다시 실행합니다.

### 종료하기

1. `npm run dev`를 실행한 창에서 `Ctrl+C`를 누릅니다.
2. **프로젝트 폴더**의 PowerShell에서 다음 명령을 실행합니다.

```powershell
docker compose -f compose.manual-test.yaml down
```

서버가 종료되며, 입력한 데이터는 다음 실행 때도 남아 있습니다.

## 6. 데이터 보충과 초기화의 차이

### 부족한 테스트 데이터만 채우기

3번에서 비밀번호를 입력한 PowerShell 창에서 실행합니다.
새 창을 열었다면 비밀번호 입력 명령을 먼저 실행하세요.

```powershell
docker compose -f compose.manual-test.yaml run --rm seed-local
```

이미 있는 데이터를 유지하고 빠진 테스트 데이터를 채웁니다.

### 테스트하며 바꾼 seed 기록 되돌리기

```powershell
docker compose -f compose.manual-test.yaml run --rm -e SEED_MODE=reset seed-local
```

예를 들어 처음에 향수 A가 **보유**로 들어 있었는데 테스트하면서 **위시**로 바꿨다면,
이 명령으로 다시 **보유** 상태가 됩니다. 삭제한 seed 기록도 복원합니다.

- seed가 만든 기록의 수정 내용은 처음 값으로 돌아갑니다.
- 사람이 새로 추가한 게시글·댓글·컬렉션은 남습니다.
- 기존 향수·이미지와 기존 후기 테스트 22건은 초기화 대상이 아닙니다.
- 수동으로 만든 데이터와 이름 등이 충돌하면 변경을 취소하고 오류를 알립니다.

### 모든 로컬 데이터를 삭제하는 명령 — 위 초기화와 다릅니다

```powershell
docker compose -f compose.manual-test.yaml down -v
```

**직접 작성한 데이터를 포함해 DB, Redis 데이터, AI 로그가 모두 삭제됩니다.**
모든 로컬 데이터를 버려도 될 때만 사용합니다. 실행한 뒤에는 1번부터 다시 준비해야 합니다.

## 7. 막혔을 때 확인하기

| 상황 | 먼저 확인할 것 |
| --- | --- |
| `compose.manual-test.yaml`을 찾지 못함 | 프로젝트 폴더에서 PowerShell을 열었는지 확인합니다. |
| Docker 연결 오류 | Docker Desktop을 켜고 준비가 끝난 뒤 다시 실행합니다. |
| `node` 또는 `npm`을 찾지 못함 | Node.js 설치 후 PowerShell을 새로 엽니다. |
| `SEED_LOGIN_PASSWORD`가 필요하다고 나옴 | 3번 비밀번호 입력과 seed 명령을 같은 창에서 실행합니다. |
| 향수 목록이 비어 있음 | 2번 기본 데이터 적재가 성공했는지 확인합니다. |
| 진열대·게시글이 비어 있음 | 3번 활동 데이터 적재와 선택한 테스트 계정을 확인합니다. |
| 화면은 열리지만 API 요청이 실패함 | 1번 서버 상태와 아래 포트 설정을 확인합니다. |
| 로그인이나 내 정보 조회가 실패함 | 최신 코드로 서버를 다시 실행했는지, 계정과 비밀번호가 맞는지 확인합니다. |

서버가 준비되지 않으면 아래 명령으로 오류 내용을 확인하고 담당자에게 전달해주세요.

```powershell
docker compose -f compose.manual-test.yaml logs --tail=80 backend ai postgres redis
```

`Flyway`, `migration` 같은 DB 구조 변경 오류가 나면 데이터 삭제부터 하지 말고 담당자에게
오류 내용을 전달해주세요. 기존 데이터를 유지하면서 해결할 수 있는지 먼저 확인해야 합니다.

### 8080 포트를 이미 사용 중이라고 나오는 경우

IntelliJ에서 켠 백엔드와 Docker 백엔드를 동시에 실행하면 같은 포트를 사용해 충돌할 수 있습니다.
IntelliJ로 실행할 때는 아래 8번의 전환 순서를 따르세요.

다른 프로그램 때문에 기본 포트를 쓸 수 없다면 프로젝트 폴더의 `.env`에 다음처럼 설정할 수 있습니다.
이미 파일이 있다면 필요한 항목만 수정합니다.

```dotenv
MANUAL_TEST_POSTGRES_PORT=55432
MANUAL_TEST_REDIS_PORT=56379
MANUAL_TEST_BACKEND_PORT=18080
```

이 경우 서버 주소는 `http://localhost:18080`이 됩니다.
**`frontend/.env.local`의 아래 값도 함께 바꾸고 화면 실행을 다시 시작해야 합니다.**

```dotenv
VITE_API_PROXY_TARGET=http://localhost:18080
```

위 숫자는 예시입니다. 다른 포트를 사용했다면 같은 숫자로 맞춰주세요.

## 8. 백엔드를 IntelliJ에서 직접 실행할 때만

화면 테스트만 하는 팀원은 이 부분을 따라 할 필요가 없습니다.
백엔드 코드를 수정하는 경우 JDK 21과 IntelliJ를 준비합니다.

### Docker 백엔드에서 IntelliJ로 전환

프로젝트 폴더에서 실행합니다.

```powershell
docker compose -f compose.manual-test.yaml stop backend
docker compose -f compose.manual-test.yaml up -d postgres redis
```

`up -d postgres redis`만 실행해서는 기존 백엔드 컨테이너가 꺼지지 않으므로,
위의 `stop backend`도 필요합니다.

1. IntelliJ에서 `backend/build.gradle`을 Gradle 프로젝트로 엽니다.
2. Project SDK와 Gradle JVM을 JDK 21로 설정합니다.
3. `BackendApplication` 실행 설정의 Active profiles에 `manual-test`를 입력합니다.
4. 실행 버튼을 누릅니다.

처음 실행하면 서버가 필요한 DB 테이블을 준비합니다.
IntelliJ로 실행한 서버에 기본 데이터를 처음 넣을 때는 서버 기동 후 프로젝트 폴더에서 실행합니다.

```powershell
docker compose -f compose.manual-test.yaml run --rm --no-deps seed
```

여기서 `--no-deps`는 데이터 적재 명령이 Docker 백엔드를 다시 켜지 않도록 하는 옵션입니다.
활동 seed는 3번의 명령을 사용할 수 있습니다.

### 환경 설정 파일의 적용 범위

| 설정 위치 | 읽는 프로그램 |
| --- | --- |
| 프로젝트 폴더의 `.env` | Docker Compose |
| `frontend/.env.local` | 화면 개발 서버 |
| IntelliJ 실행 설정의 Environment variables | IntelliJ로 실행하는 백엔드 |

**프로젝트 폴더의 `.env`는 IntelliJ에 자동 적용되지 않습니다.**
DB와 Redis 포트를 바꿨다면 IntelliJ의 Environment variables에도 같은 값을 지정합니다.

```text
MANUAL_TEST_POSTGRES_PORT=55432
MANUAL_TEST_REDIS_PORT=56379
```

Docker용 `MANUAL_TEST_BACKEND_PORT`는 IntelliJ 서버의 포트를 바꾸지 않습니다.
IntelliJ 서버도 18080으로 실행하려면 `SERVER_PORT=18080`을 별도로 지정하고,
화면의 `VITE_API_PROXY_TARGET`도 같은 주소로 맞춥니다.
DB 이름·계정·비밀번호도 바꿨다면 IntelliJ에서는 `SPRING_DATASOURCE_URL`,
`SPRING_DATASOURCE_USERNAME`, `SPRING_DATASOURCE_PASSWORD`로 접속 정보를 지정합니다.

Docker 방식으로 돌아갈 때는 IntelliJ 서버를 종료하고 1번의 명령을 실행합니다.

## 9. AI 기능과 자세한 안내

AI 서버는 API 키가 없어도 사전에 등록된 표현을 이용해 검색할 수 있습니다.
외부 AI 모델 호출까지 확인해야 할 때만 담당자에게 받은 키를 프로젝트 폴더의 `.env`에 넣습니다.

```dotenv
GMS_API_KEY=발급받은_GMS_키
BACKEND_GMS_MODEL=gpt-5-nano
NLR_GMS_MODEL=gpt-5.4-nano
```

설정한 뒤 1번 서버 실행 명령을 다시 실행합니다. 키가 들어 있는 파일은 Git에 올리지 않습니다.
AI 서버가 켜졌다는 것과 화면에서 자연어 추천을 끝까지 사용할 수 있다는 것은 별개입니다.
화면·백엔드의 연결 상태도 함께 확인해야 합니다.

- [화면 실행 안내](../frontend/README.md)
- [백엔드 개발 안내](../backend/README.md)
- [기본 데이터 적재 안내](../backend/db/seed/README.md)

활동 seed의 상세 구성과 검증 방법은
`backend/db/seed/README.md`에서 확인할 수 있습니다.
