# 백엔드 개발 가이드라인

이 문서는 `backend/`와 그 하위 경로를 작업하는 사람과 AI 에이전트가 따라야 하는 공통 개발 지침입니다.
이 문서의 모든 상대 경로는 `backend/`를 기준으로 합니다.

## 1. 지침을 적용하는 방법

- **반드시**, **금지**는 예외 없이 지켜야 하는 규칙입니다.
- **권장**은 특별한 이유가 없다면 따르는 기본 선택입니다.
- 코드·설정과 이 문서가 다르면 임의로 한쪽을 정답으로 가정하지 말고 차이를 보고합니다.
- 정확한 의존성 및 버전은 `build.gradle`, 현재 스키마는 `src/main/resources/db/migration`을 기준으로 확인합니다.
- 작업과 관계없는 파일이나 사용자의 기존 변경사항은 수정하지 않습니다.

### 작업 전 체크리스트

1. 작업 범위와 Jira 이슈 키를 확인합니다.
2. 최신 `develop`에서 작업 브랜치를 생성합니다.
3. 관련 도메인의 Controller, Service, Repository, DTO, 테스트를 먼저 확인합니다.
4. 스키마·API·로그·메트릭 중 함께 변경되어야 할 항목을 확인합니다.

### 작업 완료 체크리스트

1. 변경에 맞는 단위 테스트와 통합 테스트를 작성하거나 갱신합니다.
2. API 변경 시 Swagger 문서가 실제 요청·응답과 일치하는지 확인합니다.
3. 엔티티 또는 컬럼 변경 시 새 Flyway 마이그레이션이 포함됐는지 확인합니다.
4. 로그와 Swagger 예시에 비밀번호, 토큰, 개인정보가 없는지 확인합니다.
5. 관련 테스트와 빌드를 실행하고 결과를 보고합니다.

## 2. 프로젝트와 실행 환경

향수 추천 서비스 "향해(hyanghae)"의 백엔드입니다. Java 21과 Spring Boot를 사용하며 기준 패키지는
`com.hyanghae.backend`입니다. `backend/`는 모노레포 안의 독립된 Gradle 루트 프로젝트이므로 Gradle 명령은
항상 `backend/`에서 실행합니다.

### 자주 사용하는 명령

Windows는 `.\gradlew.bat`, macOS/Linux는 `./gradlew`를 사용합니다. 아래 명령은 macOS/Linux 기준입니다.

```bash
# 로컬 인프라: 저장소 루트에서 실행
docker compose -f compose.manual-test.yaml up -d
docker compose -f compose.manual-test.yaml ps
docker compose -f compose.manual-test.yaml down

# 애플리케이션과 Gradle: backend/에서 실행
./gradlew bootRun --args="--spring.profiles.active=manual-test"
./gradlew compileJava
./gradlew test
./gradlew assemble -x test
```

수동 테스트 환경의 확인 주소는 다음과 같습니다.

- Health: `http://localhost:8080/actuator/health`
- Swagger UI: `http://localhost:8080/swagger-ui/index.html`
- OpenAPI JSON: `http://localhost:8080/v3/api-docs`

## 3. 코드 구조와 계층별 책임

- 기능 코드는 `com.hyanghae.backend.<domain>`처럼 도메인 단위로 배치합니다.
- 여러 도메인이 공유하는 응답과 예외 계약만 `global`에 둡니다.
- 의존성은 생성자 주입을 사용합니다. 필드 주입은 사용하지 않습니다.
- Controller는 HTTP 입력 검증, 요청 변환, 응답 반환과 Service 호출만 담당합니다.
- Service는 비즈니스 규칙과 트랜잭션 경계를 담당합니다.
- Repository는 데이터 접근만 담당하며 `ResponseEntity` 같은 웹 계층 타입에 의존하지 않습니다.
- 조회 성능을 위한 DTO 프로젝션은 사용할 수 있지만 비즈니스 로직은 Repository에 작성하지 않습니다.
- Entity를 API 응답으로 직접 반환하지 않고 응답 DTO로 변환합니다.
- 페이징 응답은 Spring Data의 `Page`를 직접 반환하지 않고, API 명세가 정한 필드명을 쓰는 도메인별 응답 record로 감쌉니다. 목록 필드명이 도메인마다 다르므로(`perfumes`, `posts`) 필드명이 고정된 제네릭 응답으로는 표현할 수 없습니다.
- 이유가 명확하지 않은 새 추상화나 공통 계층을 먼저 만들지 않습니다. 반복되는 요구가 확인된 뒤 공통화합니다.

### 패키지 목표 구조

백엔드는 계층을 최상위에 모으지 않고 도메인을 먼저 나눈 뒤, 각 도메인 안에서 계층별 하위 패키지를 사용합니다.

```text
com.hyanghae.backend
├─ global
│  ├─ exception   ErrorCode(인터페이스), BusinessException, GlobalExceptionHandler
│  ├─ response    ApiErrorResponse
│  └─ logging     RequestIdFilter
└─ perfume
   ├─ controller
   ├─ service
   ├─ repository
   ├─ entity
   ├─ dto/response
   └─ exception    PerfumeErrorCode
```

- Java 패키지는 `com.hyanghae.backend.<domain>.<layer>` 형식을 사용합니다.
- 각 도메인에는 실제로 필요한 하위 패키지만 만듭니다. 코드가 없는 `global/config`, `perfume/dto/request` 같은 패키지는 미리 만들지 않습니다.
- 여러 도메인이 함께 사용하는 코드만 `com.hyanghae.backend.global`에 둡니다. 인프라·설정·공통 응답 계약만 두고, 비즈니스 의미가 있는 코드는 도메인 안에 둡니다.
- 도메인별 에러 코드는 해당 도메인의 `exception` 패키지에 둡니다. `global/exception`에는 규격인 `ErrorCode` 인터페이스만 둡니다. 모든 도메인이 하나의 enum을 공유하면 팀원들이 같은 파일을 동시에 고쳐 머지 충돌이 반복됩니다.
- JPQL 생성자 표현식(`SELECT new com.hyanghae...`)은 문자열이라 클래스를 옮길 때 컴파일러가 잡아주지 않습니다. 패키지를 이동하면 통합 테스트로 확인합니다.
- 기존 평면 패키지는 관련 리팩터링 범위에서 목표 구조로 이동하며, 다른 작업에서 일부 클래스만 임의로 옮기지 않습니다.

## 4. API와 Swagger

API를 추가하거나 동작, 경로, 파라미터, 요청·응답 형식을 변경하면 같은 작업에서 Swagger 문서도 갱신합니다.
Swagger는 문서일 뿐이며 실제 검증과 오류 처리를 대신하지 않습니다.

### 작성 규칙

- HTTP 요청값은 요청 DTO의 Bean Validation으로 검증하고 Controller에서 `@Valid`를 적용합니다.
- 형식과 필수값은 요청 DTO에서, 도메인 비즈니스 규칙은 Service에서 검증합니다.
- Controller에는 도메인을 설명하는 `@Tag`를 작성합니다.
- 외부에 공개되는 각 엔드포인트에는 `@Operation`으로 요약과 동작을 작성합니다.
- `@ApiResponse`에는 성공 응답과 실제로 발생 가능한 주요 오류 응답을 작성합니다.
- 요청·응답 DTO에는 필드 의미, 제약조건 또는 예시가 필요할 때 `@Schema`를 작성합니다.
- 경로·쿼리 파라미터의 의미가 이름만으로 충분하지 않으면 `@Parameter`로 보충합니다.
- Swagger에 적은 상태 코드, 필드명, 필수 여부와 예시는 실제 구현과 일치해야 합니다.
- Entity 내부 구조를 문서 스키마로 직접 노출하지 않습니다.
- 비밀번호, 인증 토큰, 개인정보 또는 실제 운영 데이터를 예시로 사용하지 않습니다.
- 중복을 줄인다는 이유만으로 실제 반환 가능한 오류 응답을 생략하지 않습니다.
- 빈 목록은 `null`이 아니라 빈 배열로 반환합니다.
- 생성은 `201 Created`, 일반 조회·수정은 `200 OK`, 응답 본문이 없는 삭제는 `204 No Content`를 기본으로 사용합니다.

현재 Swagger와 OpenAPI 문서는 기본 설정 및 `prod`에서 비활성화되고 `manual-test` 프로필에서만 활성화됩니다.
문서 변경 후 `manual-test`로 실행하여 Swagger UI와 `/v3/api-docs`를 확인합니다.

## 5. 예외와 공통 응답

- 모든 오류 응답은 `ApiErrorResponse(code, message)` 형식을 사용합니다.
- 예상 가능한 비즈니스 오류는 도메인 패키지의 `XxxErrorCode`로 정의하고 `BusinessException`으로 전달합니다.
- 에러 코드 enum 상수에는 도메인 접두사를 붙입니다. 예: `PERFUME_NOT_FOUND`, `USER_NOT_FOUND`.
- 도메인마다 단순 전달용 예외 클래스를 추가하지 않습니다. 별도 포착이나 추가 데이터가 필요할 때만 확장합니다.
- Controller에서 예외를 임의 응답으로 바꾸지 않고 `GlobalExceptionHandler`의 공통 처리를 사용합니다.
- 예상하지 못한 오류의 내부 메시지와 스택트레이스를 클라이언트 응답에 노출하지 않습니다.
- API 오류를 추가하거나 변경하면 해당 Swagger 오류 응답과 예외 처리 테스트를 함께 갱신합니다.

## 6. JPA, 트랜잭션과 Flyway

### 스키마 규칙

- 데이터베이스 스키마의 소유자는 Flyway입니다. Hibernate로 테이블을 생성하거나 갱신하지 않습니다.
- 엔티티를 추가하거나 컬럼을 변경하면 `src/main/resources/db/migration/V{n}__{설명}.sql`을 함께 작성합니다.
- 이미 적용된 마이그레이션은 수정하지 않고 새 버전의 마이그레이션을 추가합니다.
- 마이그레이션 버전과 이름은 기존 파일을 확인한 뒤 다음 순서로 정합니다.

### JPA와 트랜잭션 규칙

- 트랜잭션 경계는 Service에 둡니다.
- 조회 전용 Service 메서드는 `@Transactional(readOnly = true)`를 사용합니다.
- 연관관계는 기본적으로 지연 로딩을 사용합니다.
- Entity 전체에 공개 `@Setter`를 사용하지 않고 상태 변경은 의미가 드러나는 메서드로 처리합니다.
- 지연 로딩과 Entity 변경은 트랜잭션 안에서 끝내고 Controller까지 영속 객체를 전달하지 않습니다.
- 목록 API를 추가할 때 N+1 쿼리, 안정적인 정렬, 페이지 크기 제한을 확인합니다.
- 사용자 검색어를 `LIKE`에 사용할 때 `%`, `_`, 이스케이프 문자로 전체 조회가 발생하지 않도록 처리합니다.

## 7. 프로필과 설정

`application.yaml`에는 활성 프로필을 고정하지 않습니다. IntelliJ Active profiles 또는
`--spring.profiles.active`로 주입합니다.

| 프로필 | 설정 파일 | 용도 |
| --- | --- | --- |
| `manual-test` | `src/main/resources/application-manual-test.yaml` | 로컬 수동 API 테스트, Swagger 및 debug 로그 |
| `test` | `src/test/resources/application-test.yaml` | Testcontainers 기반 자동 통합 테스트 |
| `prod` | `src/main/resources/application-prod.yaml` | 운영 로그와 메트릭 설정 |

- 접속 정보와 비밀값을 저장소에 하드코딩하지 않습니다.
- `manual-test`의 접속 정보는 `MANUAL_TEST_POSTGRES_PORT`, `MANUAL_TEST_REDIS_PORT` 등의 환경변수로 덮어쓸 수 있습니다.
- 설정 기본값이나 프로필 적용 범위를 변경하면 해당 프로필로 컨텍스트가 정상 구동되는지 검증합니다.

## 8. 로깅과 보안

- 로그는 stdout으로만 출력합니다. 파일 appender를 추가하지 않습니다.
- `RequestIdFilter`가 요청 완료 로그를 남기므로 Controller와 Service에서 요청 단위 접근 로그를 중복 작성하지 않습니다.
- HTTP 경로는 실제 URI 대신 `HandlerMapping.BEST_MATCHING_PATTERN_ATTRIBUTE`의 경로 패턴을 기록합니다.
- 쿼리스트링, 비밀번호, 토큰, 인증 헤더, 개인정보와 요청·응답 본문 전체를 로그에 남기지 않습니다.
- 로그 메시지는 Loki에서 검색할 수 있도록 `key=value`를 쉼표로 연결합니다.
- 처리한 예외를 새로 로깅할 때는 중복 로그 여부와 스택트레이스 필요 여부를 먼저 확인합니다.
- 새 로그 테스트에는 필요한 내용이 존재한다는 단언과 민감값이 없다는 단언을 함께 작성합니다.
- 새 로거는 기존 코드와 같이 `LoggerFactory`를 통한 명시적 선언을 사용합니다.
- `@Async`나 별도 스레드를 도입하면 MDC의 `requestId` 전파를 함께 처리합니다.

운영 로그 조회와 장애 대응 방법은 [운영 모니터링 및 Grafana 사용 가이드](operational-logging.md)를 참고합니다.

## 9. 메트릭

- `/actuator/prometheus` 엔드포인트는 `prod` 프로필에서만 노출합니다.
- Actuator 엔드포인트는 allowlist로 노출하며 `*`를 사용하지 않습니다.
- `/actuator/prometheus`는 반복 요청 로그에서 제외하되 메트릭 수집은 유지합니다.
- 사용자 ID, 요청 파라미터처럼 값의 가짓수가 계속 늘어나는 데이터를 메트릭 태그로 사용하지 않습니다.
- 히스토그램 메트릭을 추가하면 기대하는 최소·최대 범위를 함께 지정합니다.
- 메트릭 설정을 변경하면 `PrometheusMetricsIntegrationTest`의 단언도 함께 갱신합니다.
- 애플리케이션 빈이 계측에 영향을 주면 최소 테스트 설정인 `MetricsTestApplication`에 해당 빈을 명시적으로 포함합니다.

## 10. 테스트

### 테스트 유형

- 단위 테스트는 DB, Redis, 외부 API 없이 순수 JUnit으로 작성합니다.
- 통합 테스트는 클래스에 `@IntegrationTest`를 붙입니다.
- `@IntegrationTest`가 `@SpringBootTest`, `@ActiveProfiles("test")`, Testcontainers 설정을 적용하므로 접속 URL을 하드코딩하지 않습니다.
- 통합 테스트 실행 시 Docker Desktop이 필요합니다. 수동 테스트용 Compose를 미리 실행할 필요는 없습니다.
- 테스트 코드는 운영 코드와 동일한 패키지 구조로 `src/test/java` 아래에 둡니다.
- 새 동작에는 정상 사례와 대표적인 실패 또는 경계 사례를 테스트합니다.
- 테스트는 내부 메서드 호출 횟수보다 외부에서 관찰 가능한 결과를 검증합니다.

### 변경 유형별 최소 검증

| 변경 유형 | 최소 검증 |
| --- | --- |
| 순수 비즈니스 로직 | 관련 단위 테스트 |
| Controller, 직렬화, 예외 응답 | MVC 또는 통합 테스트 |
| Repository, Entity, Flyway | Testcontainers 통합 테스트 |
| 로깅 | 로그 내용과 민감값 미포함 테스트 |
| 메트릭 및 프로필 설정 | 해당 프로필 통합 테스트 |
| Swagger | `manual-test`의 Swagger UI 또는 `/v3/api-docs` 확인 |

필요한 범위부터 빠르게 확인한 뒤 전체 테스트를 실행합니다.

```bash
./gradlew test --tests "com.hyanghae.backend.global.logging.RequestIdFilterTest"
./gradlew test
```

### Windows 비ASCII 경로 주의

Windows에서 저장소 경로에 한글 등 비ASCII 문자가 포함되면 Gradle 테스트 워커가
`ClassNotFoundException`을 낼 수 있습니다. 컴파일은 성공하지만 테스트 실행만 실패하고 모든 테스트 클래스에서
같은 증상이 발생한다면 저장소를 `C:\dev\S15P21E203` 같은 ASCII 경로로 옮깁니다.

## 11. Git과 CI

- `master`와 `develop`에 직접 Push하지 않고 모든 변경을 MR로 병합합니다.
- 작업 브랜치는 최신 `develop`에서 만들며 형식은 `<type>/<scope>/S15P21E203-<이슈번호>-<slug>`입니다.
- 커밋 형식은 `<type>: <작업 내용>`이며 Jira 이슈 키와 문장 끝의 마침표를 넣지 않습니다.
- 하나의 Jira 이슈는 하나의 브랜치에서 처리하고, 한 커밋에는 하나의 의미 있는 작업만 담습니다.
- MR 대상은 `develop`이며 빌드와 테스트를 통과한 뒤 병합합니다.
- MR 생성 전에 최신 `origin/develop`을 반영하고 충돌 해결 후 다시 빌드와 테스트를 실행합니다.
- 줄바꿈은 LF를 사용합니다. `.bat`와 `.cmd`만 CRLF를 사용합니다.
- MR 템플릿은 저장소 루트의 `.gitlab/merge_request_templates/Default.md`를 사용합니다.

CI는 `develop`과 `master`에서 Gradle 빌드와 테스트를 실행합니다. 로컬 테스트 실패를 무시한 채 MR을 만들지 않습니다.

## 12. 참고 문서

- [백엔드 개발 시작 가이드](../README.md)
- [운영 모니터링 및 Grafana 사용 가이드](operational-logging.md)
- [성능 테스트 가이드](performance-testing.md)
- [후기 키워드 추출 배치 가이드](review-analysis-batch.md)
