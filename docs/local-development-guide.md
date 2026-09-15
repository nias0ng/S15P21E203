# 로컬 개발 환경 빠른 시작

처음 프로젝트를 실행하는 팀원을 위한 최소 절차입니다. 백엔드, PostgreSQL, Redis와 자연어 추천
AI 서버를 Docker Desktop으로 한 번에 실행할 수 있습니다.

## 먼저: 프로젝트 폴더에서 터미널 열기

프로젝트를 저장한 위치는 사람마다 다릅니다. 아래 순서로 시작하면 저장 경로를 직접 입력할 필요가
없습니다.

1. Windows 파일 탐색기에서 내려받은 프로젝트 폴더를 엽니다.
2. `compose.manual-test.yaml` 파일과 `backend`, `frontend`, `ai` 폴더가 함께 보이는지 확인합니다.
3. 탐색기 위쪽 주소 표시줄을 클릭하고 `powershell`을 입력한 뒤 Enter를 누릅니다.
4. 열린 PowerShell 창에 아래 명령을 입력합니다.

```powershell
Test-Path .\compose.manual-test.yaml
```

`True`가 나오면 준비됐습니다. `False`가 나오면 2번의 파일이 보이는 폴더에서 다시 열어주세요.

이 문서에서 **프로젝트 폴더** 또는 **저장소 최상위 폴더**는 바로 이 폴더를 뜻합니다.
폴더 이름이나 앞에 붙는 경로는 팀원마다 달라도 됩니다.

## 처음 실행할 때는 아래 두 명령만 실행하세요

Docker Desktop을 켜고, 앞에서 연 PowerShell 창에 아래 두 명령을 위에서부터 한 줄씩 실행하면
됩니다.

```powershell
docker compose -f compose.manual-test.yaml up -d --build --wait
docker compose -f compose.manual-test.yaml run --rm seed
```

- 첫 번째 명령은 백엔드, AI 서버, PostgreSQL, Redis를 실행합니다.
- 두 번째 명령은 향 지도, 향수 카탈로그, 노트, 향수 이미지 데이터를 DB에 넣습니다.

두 명령이 오류 없이 끝나면 로컬 실행 준비가 완료된 것입니다. 이 문서의 아래 내용은 각 명령이
하는 일, 개발 방식별 실행 방법, 오류가 발생했을 때 해결하는 방법을 자세히 설명합니다. 처음 실행할
때 아래 내용을 전부 따라 할 필요는 없습니다.

## 1. 필요한 프로그램

- Git
- Docker Desktop

백엔드 코드를 직접 개발하는 팀원만 다음 프로그램도 설치합니다.

- JDK 21
- IntelliJ IDEA

터미널에서 다음 명령이 실행되는지 확인합니다.

```bash
git --version
docker --version
docker compose version
```

백엔드 개발자는 `java -version`의 결과가 21인지 추가로 확인합니다. 아래 작업을 시작하기 전에
Docker Desktop을 실행합니다. Gradle과 Python은 이미지에 포함되므로 전체 환경을 실행하기 위해
별도로 설치할 필요가 없습니다.

## 2. 전체 환경 실행

**저장소 최상위 폴더**에서 실행합니다.

```bash
docker compose -f compose.manual-test.yaml up -d --build --wait
docker compose -f compose.manual-test.yaml ps
```

처음 실행하거나 백엔드·AI 코드가 변경됐을 때 `--build`가 이미지를 새로 만듭니다. `--wait`는 네
서비스가 준비될 때까지 기다립니다. 변경된 것이 없다면 다음 실행부터 `--build`를 생략해도 됩니다.

`postgres`, `redis`, `ai`, `backend`가 모두 `healthy`이면 준비된 것입니다.

- 백엔드: `http://localhost:8080`
- Swagger UI: `http://localhost:8080/swagger-ui/index.html`
- 상태 확인: `http://localhost:8080/actuator/health`

백엔드는 로컬 PC에서만 접근할 수 있도록 `127.0.0.1:8080`으로 연결합니다. AI 서버는 호스트에
8000번 포트를 공개하지 않으며 Compose 내부의 백엔드는 `http://ai:8000`으로 접근할 수 있습니다.

AI 서버 상태는 다음 명령으로 직접 확인할 수 있습니다.

```bash
docker compose -f compose.manual-test.yaml exec -T ai python -c "import urllib.request; print(urllib.request.urlopen('http://127.0.0.1:8000/health').read().decode())"
```

`"status":"ok"`가 포함된 JSON이 출력되면 정상입니다. `"llm":false`는 AI 서버가 고장 난 것이
아니라 `GMS_API_KEY`가 없어 사전 매칭 모드로 실행 중이라는 뜻입니다.

LLM까지 확인해야 할 때만 저장소 최상위에 커밋하지 않는 `.env` 파일을 만들고 값을 넣습니다.

```dotenv
GMS_API_KEY=발급받은_GMS_키
BACKEND_GMS_MODEL=gpt-5-nano
NLR_GMS_MODEL=gpt-5.4-nano
```

백엔드와 AI 서버가 사용할 수 있는 모델이 다를 수 있으므로 각각 `BACKEND_GMS_MODEL`과
`NLR_GMS_MODEL`로 구분합니다.

## 3. 백엔드 코드를 IntelliJ에서 개발할 때

백엔드 코드를 직접 수정하고 디버깅할 때는 백엔드 컨테이너를 실행하지 않습니다. PostgreSQL과
Redis만 실행합니다.

```bash
docker compose -f compose.manual-test.yaml up -d postgres redis
```

그다음 다음 순서로 백엔드를 실행합니다.

1. `backend/build.gradle`을 Gradle 프로젝트로 엽니다.
2. Project SDK와 Gradle JVM을 JDK 21로 설정합니다.
3. `BackendApplication` 실행 설정의 Active profiles에 `manual-test`를 입력합니다.
4. `BackendApplication`을 실행합니다.

터미널에서 직접 실행할 수도 있습니다. Windows PowerShell에서는 다음 명령을 사용합니다.

```powershell
cd backend
.\gradlew.bat bootRun --args="--spring.profiles.active=manual-test"
```

macOS 또는 Linux에서는 다음 명령을 사용합니다.

```bash
cd backend
./gradlew bootRun --args="--spring.profiles.active=manual-test"
```

처음 실행하면 Flyway가 DB 테이블을 최신 상태로 자동 생성합니다. 이 방식에서는 AI 서버를 실행하지
않습니다. 자연어 추천까지 확인할 때는 2번의 전체 환경을 사용합니다.

## 4. DB 초기 데이터 넣기

전체 환경을 실행한 뒤 **저장소 최상위 폴더**에서 아래 명령 하나만 실행합니다.

```powershell
docker compose -f compose.manual-test.yaml run --rm seed
```

이 명령이 Docker 안에서 다음 데이터를 순서대로 넣습니다.

1. 향 지도
2. 향수 카탈로그
3. 노트 메타데이터
4. 향수 이미지

Git Bash, `docker cp`, `cd backend/db/seed`는 필요 없습니다. 여러 번 실행해도 같은 데이터를
갱신하므로 중복이 늘어나지 않습니다. 마지막에 `모든 초기 데이터 적재가 끝났습니다`가 나오면
성공입니다.

### 데이터가 실제로 들어갔는지 확인

AI 상태 응답에 나오는 `"perfumes":129161`은 AI가 가지고 있는 검색 데이터 수입니다.
PostgreSQL에 들어간 향수 수가 아닙니다. 데이터 적재가 끝나면 PowerShell에서 다음 명령으로 DB를
직접 확인하세요. 앞에서 사용한 PowerShell 창에서 그대로 실행하면 됩니다.

```powershell
docker exec hyanghae-manual-test-postgres-1 psql -U hyanghae -d hyanghae_test -c "SELECT (SELECT count(*) FROM brands) AS brands, (SELECT count(*) FROM accords) AS accords, (SELECT count(*) FROM perfumes) AS perfumes, (SELECT count(*) FROM perfume_accords) AS perfume_accords, (SELECT count(*) FROM notes WHERE image_url IS NOT NULL) AS notes_with_image, (SELECT count(*) FROM perfume_images WHERE image_type = 'ORIGINAL') AS original_images, (SELECT count(*) FROM perfume_images WHERE image_type = 'PAPER_TEXTURE') AS paper_texture_images;"
```

정상 적재 후 값은 다음과 같습니다.

| 항목 | 기대값 |
| --- | ---: |
| brands | 7,793 이상 |
| accords | 92 |
| perfumes | 129,161 이상 |
| perfume_accords | 1,000,570 |
| notes_with_image | 246 |
| original_images | 156 |
| paper_texture_images | 156 |

세부 적재 순서와 운영 데이터 주의사항은
[DB 데이터 적재 문서](../backend/db/seed/README.md)를 확인합니다.

## 5. 종료와 다시 실행

**저장소 최상위 폴더**에서 실행합니다. IntelliJ로 백엔드를 실행했다면 애플리케이션도 종료합니다.

```bash
docker compose -f compose.manual-test.yaml down
```

이 명령은 컨테이너만 종료하므로 DB 데이터와 AI 서버의 NLR 로그는 유지됩니다. 다음 개발 때 필요한
실행 방식에 따라 2번 또는 3번만 다시 진행하면 됩니다.

DB 데이터를 전부 지우고 처음부터 시작해야 할 때만 다음 명령을 사용합니다.

```bash
docker compose -f compose.manual-test.yaml down -v
```

`-v`를 사용하면 입력한 DB 데이터와 NLR 로그가 모두 삭제됩니다. 필요한 데이터가 없는지 확인한 뒤
실행합니다.

## 6. 자주 발생하는 문제

### 컨테이너가 실행되지 않음

Docker Desktop이 실행 중인지 확인하고 로그를 봅니다.

```bash
docker compose -f compose.manual-test.yaml logs postgres
docker compose -f compose.manual-test.yaml logs redis
docker compose -f compose.manual-test.yaml logs ai
docker compose -f compose.manual-test.yaml logs backend
```

### 8080 포트를 사용할 수 없다고 나옴

다음과 비슷한 오류입니다.

```text
ports are not available
listen tcp4 127.0.0.1:8080: bind
```

다른 프로그램이 8080 포트를 쓰고 있는지 확인합니다.

```powershell
netstat -ano -p tcp | Select-String ':8080'
```

`LISTENING`이 나오면 출력 맨 오른쪽 숫자가 프로그램의 PID입니다. 예를 들어 PID가 `11404`라면
다음처럼 확인합니다.

```powershell
Get-Process -Id 11404
```

IntelliJ에서 실행한 백엔드처럼 종료해도 되는 프로그램이 맞을 때만 종료합니다.

```powershell
Stop-Process -Id 11404 -Force
```

포트가 비었는데 실패한 backend 컨테이너가 그대로 남아 있으면 다시 만듭니다.

```powershell
docker compose -f compose.manual-test.yaml up -d --force-recreate backend
docker compose -f compose.manual-test.yaml ps
```

PID는 실행할 때마다 달라집니다. 예시의 `11404`를 그대로 사용하지 말고, 본인의 `netstat` 결과를
사용해야 합니다.

### 5432 또는 6379 포트를 이미 사용 중이라고 나옴

PC에서 같은 포트를 사용하는 프로그램을 종료한 뒤 다시 실행합니다. IntelliJ에서 백엔드를 이미
실행했다면 8080번을 사용하므로 종료해야 합니다.

기존 프로그램을 유지해야 한다면 저장소 최상위의 `.env`에서 로컬 포트를 변경할 수 있습니다.

```dotenv
MANUAL_TEST_POSTGRES_PORT=55432
MANUAL_TEST_REDIS_PORT=56379
MANUAL_TEST_BACKEND_PORT=18080
```

이 예시에서는 백엔드 주소도 `http://localhost:18080`으로 바뀝니다.

### `Detected resolved migration not applied to database` 오류

예를 들어 다음 오류가 나올 수 있습니다.

```text
Detected resolved migration not applied to database: 10
```

이 오류는 예전에 만든 DB에는 V11이 적용돼 있는데, 현재 코드에는 그보다 번호가 작은 V10 파일이
추가돼 있을 때 발생합니다.

테스트 DB의 데이터가 필요 없다면 아래 방법이 가장 쉽습니다. **DB와 Redis의 기존 데이터가 모두
삭제됩니다.**

```powershell
docker compose -f compose.manual-test.yaml down -v
docker compose -f compose.manual-test.yaml up -d --build --wait
```

기존 DB 데이터를 살려야 한다면 아래 명령으로 빠진 마이그레이션을 한 번만 적용합니다.

```powershell
docker compose -f compose.manual-test.yaml run -d --name hyanghae-migration-repair -e SPRING_FLYWAY_OUT_OF_ORDER=true backend
docker logs -f hyanghae-migration-repair
```

로그에 `Successfully applied`와 `Started BackendApplication`이 나오면 `Ctrl+C`로 로그 보기를 끝내고
다음 명령을 실행합니다.

```powershell
docker rm -f hyanghae-migration-repair
docker compose -f compose.manual-test.yaml up -d --force-recreate backend
docker compose -f compose.manual-test.yaml ps
```

이 방법은 로컬 수동 테스트 DB에서만 사용하세요. 운영 DB에서는 임의로 실행하면 안 됩니다.

### `/tmp/seed` 폴더가 없다고 나옴

```text
chdir to cwd ("/tmp/seed") failed: no such file or directory
```

예전 방식으로 `docker cp`와 `docker exec`를 따로 실행해서 생긴 오류입니다. 이제 두 명령을 직접
사용하지 말고 저장소 최상위 폴더에서 새 명령 하나만 실행합니다.

```powershell
docker compose -f compose.manual-test.yaml run --rm seed
```

### `GetFileAttributesEx ... backend` 경로 오류

예전 방식에서 현재 폴더와 복사 경로가 맞지 않아 생긴 오류입니다. 문서 맨 위의
**프로젝트 폴더에서 터미널 열기**를 따라 PowerShell을 다시 열고 아래 명령을 실행하세요.

```powershell
docker compose -f compose.manual-test.yaml run --rm seed
```

### `cd backend/db/seed` 경로가 없다고 나옴

PowerShell 프롬프트가 이미 `...\backend\db\seed>`로 끝나는데 `cd backend/db/seed`를 한 번 더
실행해서 생긴 오류입니다. 이미 해당 폴더에 있으므로 `cd`를 다시 실행하지 마세요.

문서 맨 위의 **프로젝트 폴더에서 터미널 열기**를 따라 PowerShell을 다시 열어주세요.
새 데이터 넣기 명령은 프로젝트 폴더에서 실행하므로 `backend/db/seed`로 이동할 필요가 없습니다.

### `.sh` 파일을 실행할 수 없다고 나옴

```text
load_perfume_catalog.sh 용어가 ... 인식되지 않습니다
```

`.sh`는 PowerShell 파일이 아닙니다. 개별 스크립트를 직접 실행할 필요가 없어졌으므로 저장소
최상위 폴더에서 다음 명령만 실행합니다. 현재 위치가 헷갈리면 문서 맨 위의
**프로젝트 폴더에서 터미널 열기**부터 다시 따라주세요.

```powershell
docker compose -f compose.manual-test.yaml run --rm seed
```

### 복사한 명령에 `\_`나 `[http://...]`가 들어 있음

메신저나 Markdown 문서에서 명령을 복사하면서 표시용 문자가 섞인 것입니다. 터미널에는 아래처럼
입력해야 합니다.

- `hyanghae\_test`가 아니라 `hyanghae_test`
- `load\_scent\_map.sql`이 아니라 `load_scent_map.sql`
- `[http://주소](http://주소)`가 아니라 `http://주소`
- PowerShell에서는 Bash 명령의 줄 끝에 있는 `\`를 복사하지 말고 한 줄로 실행

### 테이블이 없다는 오류가 나옴

백엔드를 `manual-test` 프로필로 한 번 실행해 Flyway가 테이블을 생성하게 합니다.

### 화면이나 조회 결과가 비어 있음

4번의 초기 데이터 적재를 했는지 확인합니다. 애플리케이션 실행만으로 향수와 향 지도 데이터가
자동 입력되지는 않습니다. 특히 AI 상태 응답의 `perfumes` 수와 PostgreSQL의 향수 수는 서로 다른
값이므로, 4번의 DB 확인 명령으로 실제 적재 여부를 확인하세요.

더 자세한 백엔드 설정은 [백엔드 개발 시작 가이드](../backend/README.md)를 참고합니다.
