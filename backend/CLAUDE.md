# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 프로젝트 개요

향수 추천 서비스 "향해(hyanghae)"의 백엔드입니다. 모노레포(`backend/`, `frontend/`, `ai/`) 안에서 `backend/`는 독립된 Gradle 루트 프로젝트(`rootProject.name = 'backend'`)이므로, Gradle 명령은 항상 `backend/`에서 실행합니다.

Java 21 · Spring Boot 3.5.16 · PostgreSQL 17 · Redis 7.4 · 기준 패키지 `com.hyanghae.backend`.

도메인은 향수 데이터를 향 지도(scent map)로 시각화하고 자연어 기반 추천·리뷰·컬렉션·커뮤니티를 제공하는 서비스입니다.

## 명령어

Windows는 `.\gradlew.bat`, macOS/Linux는 `./gradlew`를 사용합니다. 아래는 후자 기준입니다.

```bash
# 로컬 인프라 (저장소 루트에서 실행, Docker Desktop 필요)
docker compose -f compose.manual-test.yaml up -d
docker compose -f compose.manual-test.yaml ps      # postgres/redis 가 healthy 인지 확인
docker compose -f compose.manual-test.yaml down    # 볼륨 유지
docker compose -f compose.manual-test.yaml down -v # 데이터까지 삭제

# 실행 (backend/ 에서)
./gradlew bootRun --args="--spring.profiles.active=manual-test"

# 빌드
./gradlew compileJava          # 빠른 컴파일 확인
./gradlew assemble -x test     # CI 가 develop/master 에서 쓰는 빌드
./gradlew bootJar

# 테스트
./gradlew test
./gradlew test --tests "com.hyanghae.backend.logging.RequestIdFilterTest"
./gradlew test --tests "com.hyanghae.backend.logging.RequestIdFilterTest.addsRequestIdToMdcAndResponseHeader"
```

`manual-test` 프로필로 실행 중일 때의 확인 지점:

- `http://localhost:8080/actuator/health`
- `http://localhost:8080/swagger-ui/index.html` — Swagger는 `manual-test`에서만 켜집니다
- `http://localhost:8080/v3/api-docs`

## 프로필 구조

`application.yaml`에는 **프로필을 고정하지 않습니다.** 활성 프로필은 IntelliJ의 Active profiles 또는 `--spring.profiles.active`로 주입해야 하며, 이 규칙을 깨면 배포 환경 설정이 로컬 값으로 덮여버립니다.

| 프로필 | 파일 | 용도 |
| --- | --- | --- |
| `manual-test` | `application-manual-test.yaml` | 로컬 수동 API 테스트. Compose로 띄운 localhost DB/Redis에 붙고 Swagger·debug 로그를 켭니다 |
| `test` | `src/test/resources/application-test.yaml` | 자동 통합 테스트. `@IntegrationTest`가 자동 적용하며 접속 정보는 Testcontainers가 주입합니다 |
| `prod` | `application-prod.yaml` | 운영. 로그 레벨만 조정하고 접속 정보는 배포 서버의 `.env`에서 옵니다 |

`manual-test`의 접속 정보는 `MANUAL_TEST_POSTGRES_PORT`, `MANUAL_TEST_REDIS_PORT` 등 환경변수로 덮어쓸 수 있습니다(포트 충돌 시 사용).

## 스키마는 Flyway가 소유합니다

세 프로필 모두 `spring.jpa.hibernate.ddl-auto: validate`입니다. **Hibernate는 테이블을 만들지 않습니다.**

엔티티를 추가하거나 컬럼을 바꾸면 반드시 `src/main/resources/db/migration/V{n}__{설명}.sql`을 함께 작성해야 하며, 그러지 않으면 애플리케이션이 부팅 단계에서 검증 실패로 죽습니다. 현재 `V1__init_schema.sql`에 users·perfumes·perfume_map_points·posts·perfume_reviews·collections·user_taste_tests 등 35개 테이블이 정의되어 있습니다. 기존 마이그레이션 파일은 적용 후 수정하지 않고 새 버전을 추가합니다.

`spring.jpa.open-in-view`는 모든 프로필에서 `false`이므로, 지연 로딩은 트랜잭션 경계 안에서 끝내야 합니다.

## 로깅

로그는 **stdout → Docker → Alloy → Grafana Loki → Logs Drilldown** 파이프라인을 탑니다. 파일 appender를 추가하지 말고 stdout으로만 남깁니다. 운영 메트릭 대시보드와 로그를 이용한 장애 대응 방법은 `docs/operational-logging.md`에 있습니다.

### RequestIdFilter가 유일한 요청 로깅 지점

`com.hyanghae.backend.logging.RequestIdFilter`(`OncePerRequestFilter`)가 요청마다 다음을 처리합니다.

1. UUID를 생성해 MDC 키 `requestId`에 넣고, 응답 헤더 `X-Request-ID`로 내려줍니다. 프론트엔드는 이 헤더 값으로 장애를 제보합니다.
2. `finally`에서 요청 완료 로그를 남깁니다.
3. 예외가 새어나오면 `ERROR`로 기록한 뒤 다시 던집니다.

컨트롤러/서비스에서 요청 단위 접근 로그를 중복으로 남기지 않습니다.

단, `/actuator/prometheus`는 `shouldNotFilter`로 필터 자체를 건너뜁니다. 메트릭 수집기인 Alloy가 주기적으로 스크레이프하는 경로라 요청 완료 로그가 계속 쌓이기 때문이고, 이 경로 응답에는 `X-Request-ID`도 붙지 않습니다. 요청 로깅 제외는 메트릭 수집에 영향을 주지 않습니다. `RequestIdFilterTest.skipsRequestLoggingForPrometheusScrapes`가 이를 단언합니다.

### 로그 메시지 형식

Loki에서 `status=5`, `requestId=<id>` 같은 문자열로 검색하므로 `키=값`을 콤마로 이어 쓰는 형식을 지킵니다.

```text
HTTP request completed: method=GET, path=/actuator/health, status=200, durationMs=1292
Unhandled HTTP request exception: method=POST, path=/api/reviews/{reviewId}, exceptionType=...
```

콘솔 패턴(`manual-test`, `prod`)에 `[requestId=%X{requestId:-}]`가 포함되어 있습니다. 애플리케이션 시작 로그처럼 HTTP 요청 밖에서 나온 로그는 `requestId`가 비어 있는 것이 정상입니다.

### 실제 경로와 쿼리스트링을 로그에 남기지 않습니다

`path`에는 `request.getRequestURI()`가 아니라 `HandlerMapping.BEST_MATCHING_PATTERN_ATTRIBUTE`에서 꺼낸 **경로 패턴**(`/api/reviews/{reviewId}`)을 씁니다. 매칭되는 패턴이 없으면 `<unmatched>`입니다. 실제 ID나 `?token=...` 같은 값이 로그로 새는 것을 막기 위한 규칙이고, `RequestIdFilterTest`가 민감값 문자열이 로그에 없음을 단언해 이를 강제합니다.

같은 이유로 비밀번호·토큰·인증 헤더·개인정보·요청/응답 본문 전체는 로그에 남기지 않습니다. `prod`에서 `org.hibernate.orm.jdbc.bind: off`인 것도 바인딩 파라미터로 개인정보가 새는 것을 막기 위함입니다.

### 로그 레벨

| | `manual-test` | `prod` |
| --- | --- | --- |
| `com.hyanghae.backend` | `debug` | `info` |
| `org.hibernate.SQL` | `debug` | `warn` |
| `org.hibernate.orm.jdbc.bind` | — | `off` |

### 새 코드에서 로거 사용

기존 코드는 Lombok이 의존성에 있음에도 `@Slf4j` 대신 명시적 선언을 씁니다.

```java
private static final Logger log = LoggerFactory.getLogger(RequestIdFilter.class);
```

MDC는 ThreadLocal이므로 `@Async`나 별도 스레드로 넘어가면 `requestId`가 유실됩니다. 비동기 처리를 추가한다면 MDC 전파를 함께 다뤄야 합니다.

### 로그를 테스트하는 법

Spring Boot의 `OutputCaptureExtension`으로 로그 내용을 검증합니다. 새로 로그를 남기는 코드를 추가할 때는 **민감값이 로그에 없다는 단언까지** 함께 씁니다.

```java
@ExtendWith(OutputCaptureExtension.class)
class SomeTest {
    @Test
    void logsSafely(CapturedOutput output) {
        assertThat(output).contains("status=201").doesNotContain("sensitive-token");
    }
}
```

## 메트릭

메트릭은 `prod` 프로필에서만 켜집니다. **Spring Boot → Alloy → Grafana Cloud → Dashboard** 파이프라인을 타며, 로그와 별도로 저장하고 조회합니다. `micrometer-registry-prometheus`가 `runtimeOnly` 의존성으로 들어가 있어 `/actuator/prometheus` 엔드포인트가 자동으로 생기고, 계측 코드는 직접 작성하지 않고 Spring Boot의 자동 계측만 사용합니다. 설정은 전부 `application-prod.yaml`의 `management` 블록에 있습니다.

### Actuator 엔드포인트는 allowlist로만 엽니다

```yaml
management:
  endpoints:
    web:
      exposure:
        include:
          - health
          - prometheus
```

`*`를 쓰지 않습니다. `env`·`heapdump`·`configprops`처럼 환경변수나 메모리 덤프를 그대로 내주는 엔드포인트가 함께 열리기 때문입니다. 새 엔드포인트가 필요하면 이 목록에 명시적으로 추가하고, 무엇이 노출되는지 확인한 뒤에 넣습니다.

`/actuator/prometheus`에는 애플리케이션 레벨 인증이 없습니다. 외부에 노출되지 않는다는 전제는 인프라 쪽 네트워크 설정에 의존합니다.

### 공통 태그

모든 메트릭에 `application=backend`(`spring.application.name`), `environment=prod`가 붙습니다. 여러 서비스와 환경이 같은 Grafana로 들어와도 구분할 수 있게 하기 위한 라벨입니다.

태그를 추가할 때는 **값의 가짓수가 유한한지** 먼저 따집니다. 사용자 ID나 요청 파라미터처럼 값이 계속 늘어나는 것을 태그로 넣으면 시계열이 폭발합니다.

### 응답시간은 히스토그램으로 내보냅니다

```yaml
distribution:
  percentiles-histogram:
    http.server.requests: true
  minimum-expected-value:
    http.server.requests: 5ms
  maximum-expected-value:
    http.server.requests: 10s
```

`percentiles-histogram`은 `http_server_requests_seconds_bucket` 시계열을 만들고, 분위수는 Grafana에서 `histogram_quantile()`로 계산합니다. 앱에서 p95를 미리 계산해 내보내는 `percentiles` 옵션을 쓰지 않는 이유는, 분위수가 합산 불가능한 값이라 인스턴스를 여러 대로 늘리면 전체 p95를 구할 수 없기 때문입니다. 버킷은 카운터라서 인스턴스끼리 더할 수 있습니다.

`minimum-expected-value`/`maximum-expected-value`는 버킷 생성 범위를 기본값보다 좁혀 시계열 개수를 줄입니다. **범위 밖 요청이 버려지는 것은 아닙니다.** 12초 걸린 요청도 `_count`와 `_sum`에 반영되고 `+Inf` 버킷에 잡히며, 해당 구간의 분위수 해상도만 낮아집니다.

새 히스토그램 메트릭을 추가할 때도 기대 범위를 함께 지정합니다.

### 스크레이프 경로는 요청 로깅에서 제외됩니다

`RequestIdFilter.shouldNotFilter`가 `/actuator/prometheus`를 요청 로깅에서 걸러냅니다. 주기적으로 반복되는 스크레이프 요청이 전부 요청 완료 로그가 되면 Loki가 노이즈로 채워지기 때문입니다. 엔드포인트 노출과 메트릭 스크레이프는 그대로 동작합니다. 자세한 내용은 위 로깅 절을 참고하세요.

### 메트릭을 테스트하는 법

`PrometheusMetricsIntegrationTest`가 `@ActiveProfiles("prod")`로 실제 운영 설정을 띄운 뒤, `/actuator/prometheus` 응답에 `http_server_requests_seconds_bucket`과 공통 태그가 포함되는지 단언합니다. DB·Redis 없이 돌리려고 `spring.autoconfigure.exclude`로 DataSource·JPA·Flyway·Redis 자동 설정을 제외합니다. 메트릭 설정을 바꿀 때는 이 테스트의 단언도 함께 갱신합니다.

## 테스트 구조

- **단위 테스트** — DB·Redis·외부 API 없이 순수 JUnit으로 작성합니다. Docker가 필요 없습니다.
- **통합 테스트** — 클래스에 `@IntegrationTest`만 붙입니다. 이 메타 애노테이션이 `@SpringBootTest` + `@ActiveProfiles("test")` + `@Import(TestcontainersConfiguration.class)`를 한꺼번에 적용합니다.

`TestcontainersConfiguration`이 `@ServiceConnection`으로 PostgreSQL 17·Redis 7.4 컨테이너를 띄우고 접속 정보를 자동 주입하므로, 테스트에 접속 URL을 하드코딩하지 않습니다. `compose.manual-test.yaml`을 미리 띄울 필요도 없습니다. 다만 **Docker Desktop은 실행 중이어야 합니다.**

테스트 코드는 운영 코드와 동일한 패키지 구조로 `src/test/java` 아래에 둡니다.

### 저장소 경로에 비ASCII 문자가 있으면 테스트가 전부 실패합니다

Windows에서 저장소 경로에 한글 등 비ASCII 문자가 포함되면 `./gradlew test`가 모든 테스트 클래스에 대해 `ClassNotFoundException`을 내며 실패합니다. 컴파일(`compileTestJava`)과 실행(`bootRun`)은 정상이므로 원인을 찾기 어렵습니다.

Gradle 테스트 워커 JVM이 클래스패스를 해석할 때 `sun.jnu.encoding`(한국어 Windows 기본값 `MS949`)과 충돌해 발생합니다. 다음은 **효과가 없음이 확인된** 시도입니다.

- `gradle.properties`에 `-Dfile.encoding=UTF-8 -Dsun.jnu.encoding=UTF-8` 추가
- ASCII 경로로 디렉터리 정션 생성 (Gradle이 실제 경로로 되돌립니다)

해결책은 저장소를 ASCII 경로(예: `C:\dev\S15P21E203`)로 옮기는 것입니다. Jenkins는 Linux의 ASCII 경로에서 실행되므로 CI는 영향을 받지 않습니다.

## CI/CD

`Jenkinsfile`(저장소 루트) 기준입니다.

- `develop`, `master`: `./gradlew clean assemble -x test` → `./gradlew test`
- `master`만 추가로: `backend/Dockerfile`로 이미지 빌드(멀티스테이지, temurin 21, 비루트 `spring` 사용자) → 배포 서버 `compose.yaml`로 기동 → `http://127.0.0.1:8081/actuator/health` 헬스 체크

로컬 테스트가 실패하는 채로 `develop`에 올리면 파이프라인이 멈춥니다.

## 저장소 규약

- **줄바꿈은 LF.** `.gitattributes`가 `* text=auto eol=lf`로 강제합니다(`.bat`/`.cmd`만 CRLF). Prettier·EditorConfig 검사와 `gradlew` 실행이 CRLF에서 깨집니다.
- **브랜치명**: `<type>/<scope>/S15P21E203-<이슈번호>-<슬러그>` (예: `chore/be/S15P21E203-85-logging`). 브랜치명의 이슈 키로 Jira가 자동 연결됩니다. 최신 `develop`에서 분기합니다.
- MR 템플릿은 `.gitlab/merge_request_templates/Default.md`입니다.

## 참고 문서

- `README.md` — 신규 팀원 환경 구성 가이드(IntelliJ 설정, 문제 해결 포함)
- `docs/operational-logging.md` — Grafana Dashboard와 Logs Drilldown을 이용한 운영 모니터링 및 장애 조사
- `docs/performance-testing.md` — k6로 변경 전후 응답 시간 비교하기(`med`, `p(95)` 기록)
