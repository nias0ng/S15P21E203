# Backend 개발 시작 가이드

이 문서는 백엔드 개발 환경을 처음 구성하는 팀원을 위한 안내서입니다.  
PostgreSQL과 Redis는 개인 PC에 직접 설치하지 않고 Docker로 실행합니다.

## 기술 환경

| 항목 | 버전 |
| --- | --- |
| Java | 21 |
| Spring Boot | 3.5.16 |
| Gradle | Wrapper 사용 |
| PostgreSQL | 17 |
| Redis | 7.4 |

## 1. 필수 프로그램

다음 프로그램을 설치합니다.

- Git
- JDK 21
- IntelliJ IDEA
- Docker Desktop

다음 프로그램은 별도로 설치하지 않습니다.

- Gradle: 프로젝트에 포함된 Gradle Wrapper를 사용합니다.
- PostgreSQL: Docker 컨테이너를 사용합니다.
- Redis: Docker 컨테이너를 사용합니다.
- Postman: 기본적인 API 확인은 Swagger UI를 사용합니다.

선택적으로 DBeaver, pgAdmin 또는 Redis Insight를 사용할 수 있습니다.

### 설치 확인

터미널에서 다음 명령이 정상적으로 실행되는지 확인합니다.

```bash
git --version
java -version
docker --version
docker compose version
```

`java -version`의 결과는 21이어야 합니다.

## 2. 프로젝트 받기

```bash
git clone https://lab.ssafy.com/s15-bigdata-recom-sub1/S15P21E203.git
cd S15P21E203
git switch develop
git pull --ff-only origin develop
```

작업을 시작할 때는 팀 브랜치 규칙에 따라 최신 `develop`에서 Jira 이슈용 브랜치를 생성합니다.

## 3. IntelliJ 설정

1. IntelliJ에서 저장소 또는 `backend` 디렉터리를 엽니다.
2. `backend/build.gradle`을 Gradle 프로젝트로 불러옵니다.
3. Project SDK와 Gradle JVM을 JDK 21로 설정합니다.
4. `BackendApplication` 실행 설정을 만듭니다.
5. 수동 API 테스트 시 **Active profiles**에 `manual-test`를 입력합니다.

프로필을 기본 `application.yaml`에 고정하지 않습니다. 실행 환경에 따라 IntelliJ의 Active profiles 또는 CLI 옵션으로 지정합니다.

## 4. 백엔드 실행

### PostgreSQL 및 Redis 실행

Docker Desktop을 실행한 뒤 저장소 루트에서 다음 명령을 실행합니다.

```bash
docker compose -f compose.manual-test.yaml up -d
docker compose -f compose.manual-test.yaml ps
```

`postgres`와 `redis`의 상태가 `healthy`인지 확인합니다.

### 애플리케이션 실행

IntelliJ에서 Active profiles를 `manual-test`로 설정하고 `BackendApplication`을 실행합니다.

CLI로 실행할 때는 다음 명령을 사용합니다.

#### Windows

```powershell
cd backend
.\gradlew.bat bootRun --args="--spring.profiles.active=manual-test"
```

#### macOS / Linux

```bash
cd backend
./gradlew bootRun --args="--spring.profiles.active=manual-test"
```

정상적으로 실행되면 다음 주소를 확인합니다.

- Health Check: http://localhost:8080/actuator/health
- Swagger UI: http://localhost:8080/swagger-ui/index.html
- OpenAPI JSON: http://localhost:8080/v3/api-docs

Swagger는 `manual-test` 프로필에서만 활성화됩니다.

### 향 지도 초기 데이터 적재

**Flyway와 애플리케이션 실행은 향 지도 데이터를 넣지 않습니다.** 마이그레이션은 표만 만들고,
국내 대표 향수 200개의 좌표·향 계열·닮은 향수·향 특성은 아래 스크립트를 직접 실행해야 들어갑니다.

적재하지 않아도 애플리케이션은 정상 실행됩니다. 대신 향수 검색 결과에 향 계열 뱃지가 없고,
주변·유사 향수와 향 지도 관련 응답이 전부 빈 목록입니다. **화면이 비어 보이면 이 단계를 건너뛴
것인지 먼저 확인하세요.**

스키마가 최신 버전까지 적용된 뒤에 실행합니다. 애플리케이션을 한 번 띄우면 Flyway가 적용합니다.

**`backend/db/seed`로 이동한 뒤** 실행합니다. `\copy`가 CSV를 psql의 현재 디렉터리에서 찾으므로
다른 곳에서 실행하면 파일을 찾지 못합니다. 바로 앞의 `docker compose` 명령이 저장소 루트 기준이니
디렉터리가 바뀐다는 점에 주의하세요.

```bash
cd backend/db/seed

docker cp . hyanghae-manual-test-postgres-1:/tmp/seed
docker exec -w /tmp/seed hyanghae-manual-test-postgres-1 \
  psql -U hyanghae -d hyanghae_test -f load_scent_map.sql
```

컨테이너 안의 psql을 씁니다. 로컬에 psql이 설치돼 있지 않아도 되고, 접속 정보를 적을 필요도
없습니다. `docker cp .` 는 이 디렉터리의 내용을 컨테이너로 복사하며, 여러 번 실행해도 덮어쓰기만
합니다.

로컬에 `psql`이 설치돼 있다면 같은 디렉터리에서 이 한 줄로도 됩니다.

```bash
psql "postgresql://hyanghae:hyanghae_test@localhost:5432/hyanghae_test" -f load_scent_map.sql
```

몇 번을 다시 실행해도 결과가 같습니다. 전체가 한 트랜잭션이라 중간에 하나라도 어긋나면 아무것도
반영되지 않고, 마지막에 적재된 행 수를 출력합니다. 아래와 같이 나오면 정상입니다.

```
 perfumes | map_points | scent_families | neighbors | perfume_accords | accords | regions_with_polygon
      200 |        200 |            303 |      2000 |            1598 |      60 |                    9
```

데이터의 형태와 주의할 점은 [backend/db/seed/README.md](db/seed/README.md)에 있습니다.

### 후기 시드 적재

후기 키워드 추출 배치를 확인할 때만 필요합니다. 후기 작성 API 가 아직 없어서, 후기가 쌓인
향수를 만들려면 시드를 넣어야 합니다. 향 지도 적재를 먼저 끝내야 합니다.

```bash
cd backend/db/seed

docker cp . hyanghae-manual-test-postgres-1:/tmp/seed
docker exec -w /tmp/seed hyanghae-manual-test-postgres-1 \
  psql -U hyanghae -d hyanghae_test -f load_review_seed.sql
```

넣는 내용은 [backend/db/seed/README.md](db/seed/README.md#후기-시드-적재), 배치를 켜는 방법은
[후기 키워드 추출 배치 가이드](docs/review-analysis-batch.md)에 있습니다.

### 서비스 종료

애플리케이션을 종료한 뒤 저장소 루트에서 다음 명령을 실행합니다.

```bash
docker compose -f compose.manual-test.yaml down
```

컨테이너를 종료해도 PostgreSQL과 Redis 데이터 볼륨은 유지됩니다.

## 5. 자동화 테스트

전체 테스트를 실행하기 전에 Docker Desktop이 실행 중이어야 합니다.

#### Windows

```powershell
cd backend
.\gradlew.bat test
```

#### macOS / Linux

```bash
cd backend
./gradlew test
```

- 단위 테스트 자체는 Docker를 사용하지 않습니다.
- `@IntegrationTest`가 적용된 통합 테스트는 Testcontainers를 사용합니다.
- 통합 테스트용 PostgreSQL과 Redis는 자동으로 생성되고 종료됩니다.
- 수동 테스트용 `compose.manual-test.yaml`을 미리 실행할 필요는 없습니다.

## 6. 테스트 작성 기준

### 단위 테스트

- DB, Redis 및 외부 API 없이 비즈니스 로직을 검증합니다.
- 일반 JUnit 테스트로 작성하며 `@IntegrationTest`를 사용하지 않습니다.

### 통합 테스트

- Controller, Service, Repository와 실제 PostgreSQL·Redis 연결을 함께 검증합니다.
- 테스트 클래스에 공통 애노테이션을 적용합니다.

```java
@IntegrationTest
class ReviewIntegrationTest {
}
```

테스트 코드는 `backend/src/test/java` 아래에 운영 코드와 동일한 패키지 구조로 작성합니다.

## 7. 추가 가이드

- 성능 개선 작업이 필요한 경우 [k6 간이 성능 테스트 가이드](docs/performance-testing.md)를 참고합니다.
- 운영 상태와 장애를 확인할 때는 [운영 모니터링 및 Grafana 사용 가이드](docs/operational-logging.md)를 참고합니다.

## 8. DB 및 Redis 직접 확인하기 (선택)

수동 테스트 결과를 DB와 Redis에서 직접 확인해야 할 때 IntelliJ Ultimate의 Database 도구 등을 사용할 수 있습니다. `compose.manual-test.yaml`을 실행한 상태에서 다음 기본 접속 정보를 사용합니다.

| 항목 | 기본값 |
| --- | --- |
| PostgreSQL Host | `localhost` |
| PostgreSQL Port | `5432` |
| Database | `hyanghae_test` |
| Username | `hyanghae` |
| Password | `hyanghae_test` |
| Redis Host | `localhost` |
| Redis Port | `6379` |

기본 포트가 이미 사용 중이면 `MANUAL_TEST_POSTGRES_PORT` 또는 `MANUAL_TEST_REDIS_PORT` 환경변수로 변경할 수 있습니다.

## 9. 문제 해결

### Docker를 찾을 수 없다는 테스트 오류

Docker Desktop이 실행 중인지 확인한 뒤 다시 테스트합니다.

```bash
docker info
```

### 5432 또는 6379 포트 충돌

PC에 직접 설치된 PostgreSQL이나 Redis가 실행 중인지 확인합니다. 기존 프로그램을 종료하거나 Compose 실행 전에 포트 환경변수를 변경합니다.

### JDK 버전 오류

IntelliJ의 Project SDK와 Gradle JVM이 모두 JDK 21인지 확인합니다.

### Lombok 코드 인식 오류

Gradle 프로젝트를 다시 불러옵니다. 문제가 계속되면 IntelliJ의 Annotation Processing 설정이 활성화되어 있는지 확인합니다.

### 수동 테스트 데이터를 모두 초기화해야 하는 경우

다음 명령은 수동 테스트용 PostgreSQL과 Redis 데이터를 모두 삭제합니다.

```bash
docker compose -f compose.manual-test.yaml down -v
```

필요한 데이터가 없는지 확인한 뒤 실행합니다.

초기화하면 향 지도 데이터도 함께 지워집니다. 컨테이너를 다시 띄우고 애플리케이션을 한 번 실행해
Flyway를 적용한 뒤, [향 지도 초기 데이터 적재](#향-지도-초기-데이터-적재)를 다시 실행하세요.
