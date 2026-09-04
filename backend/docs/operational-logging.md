# 운영 로그 및 Grafana 사용 가이드

## 1. 왜 사용하나요?

운영 서버에서 발생한 오류를 서버에 직접 접속하지 않고 확인하기 위해 사용합니다.

```text
Spring Boot stdout → Docker → Alloy → Grafana Loki → Logs Drilldown
```

다음 정보를 확인할 수 있습니다.

- 언제 오류가 발생했는지
- 어떤 API 요청이 실패했는지
- 응답 상태와 처리 시간
- 같은 요청에서 발생한 로그와 예외

현재는 로그를 직접 조회하는 단계입니다. 오류 발생 시 자동으로 알려주는 알림은 아직 구성하지 않았습니다.

## 2. 어디서 보나요?

[Grafana Logs Drilldown](https://cleversubmarine1485.grafana.net/a/grafana-lokiexplore-app/explore)에 접속합니다.

Grafana Cloud 조직에 초대된 사용자만 로그인할 수 있습니다. 일반 팀원은 `Viewer` 권한을 드렸습니다. Alloy 토큰은 사용자 로그인용이 아니므로 공유하지 않습니다.

## 3. 어떻게 보나요?

1. 오른쪽 위에서 오류가 발생한 **시간 범위**를 선택합니다.
2. **Labels → service**에서 `hyanghae-backend`를 필터링한 뒤 **Show logs**를 선택합니다.
3. `ERROR`를 먼저 확인하고 필요하면 `WARN`까지 확인합니다.
4. 검색창에 오류 메시지나 `requestId`를 입력합니다.
5. 로그 한 줄을 선택해 발생 전후의 로그를 함께 확인합니다.

자주 사용하는 검색어:

```text
Unhandled HTTP request exception
status=5
requestId=<요청 ID>
```

### 화면에서 보이는 서비스

| 이름 | 의미 |
| --- | --- |
| `hyanghae-backend` | 운영 백엔드 로그. 일반적인 오류 조사는 여기서 시작합니다. |
| `hyanghae-postgres` | 운영 PostgreSQL 로그 |
| `hyanghae-redis` | 운영 Redis 로그 |
| `testcontainers-ryuk-...` | Jenkins 테스트용 컨테이너 로그. 일반 운영 조사에서는 무시합니다. |
| 임의의 영문 이름 | 테스트 중 생성된 PostgreSQL·Redis 컨테이너일 수 있습니다. |
| `loki.source.journal...` | Ubuntu 서버, 방화벽, systemd 로그 |

## 4. 백엔드 로그 읽는 법

```text
2026-09-04T03:25:07.347Z INFO [requestId=5023ee64-...]
HTTP request completed: method=GET, path=/actuator/health,
status=200, durationMs=1292
```

| 항목 | 의미 |
| --- | --- |
| `requestId` | 요청 하나에 부여된 고유 ID |
| `method`, `path` | 호출한 API |
| `status` | HTTP 응답 상태 코드 |
| `durationMs` | 서버 처리 시간(ms) |

- `2xx`: 정상 처리
- `4xx`: 잘못된 요청, 인증·권한 실패 등
- `5xx`: 서버 내부 오류이므로 우선 확인

HTTP 요청과 무관한 시작 로그는 `requestId`가 비어 있어도 정상입니다.

## 5. Request ID로 추적하기

백엔드는 모든 HTTP 응답에 `X-Request-ID` 헤더를 제공합니다.

1. 브라우저 개발자 도구의 **Network** 탭을 엽니다.
2. 실패한 API 요청을 선택합니다.
3. **Response Headers**에서 `X-Request-ID`를 확인합니다.
4. 해당 값을 Grafana 검색창에 입력합니다.

같은 요청에서 발생한 로그를 한꺼번에 찾을 수 있습니다.

## 6. 상황별 확인 방법

### 사용자가 오류를 제보한 경우

1. 발생 시각, 실행한 기능, 상태 코드와 Request ID를 확인합니다.
2. 해당 시각 전후로 시간 범위를 설정합니다.
3. `hyanghae-backend`에서 Request ID를 검색합니다.
4. `ERROR`와 요청 완료 로그를 함께 확인합니다.

### 어젯밤 상황을 확인하는 경우

1. 시간 범위를 어젯밤으로 지정합니다.
2. `hyanghae-backend`의 `ERROR`부터 확인합니다.
3. 로그량이 갑자기 증가하거나 끊긴 구간을 확인합니다.
4. DB 문제가 의심될 때만 PostgreSQL과 Redis 로그를 확인합니다.

### 배포 직후 확인

다음 로그와 새로운 `ERROR` 발생 여부를 확인합니다.

```text
Started BackendApplication
Tomcat started on port 8080
path=/actuator/health, status=200
```

## 7. 오류 제보 시 전달할 정보

- 오류 발생 시각과 시간대
- 수행한 기능 또는 호출한 API
- HTTP 상태 코드
- `X-Request-ID`
- 재현 순서

## 8. 보안 주의사항

비밀번호, API 토큰, 인증 헤더, 개인정보, 요청·응답 본문 전체는 로그나 공유 문서에 남기지 않습니다. Alloy 토큰과 운영 서버 설정 파일도 공유하지 않습니다.

## 9. 로그가 보이지 않을 때

1. 시간 범위를 `Last 1 hour` 이상으로 넓힙니다.
2. 운영 API를 한 번 호출하고 Grafana를 새로고침합니다.
3. 계속 보이지 않으면 백엔드 컨테이너와 Alloy 상태를 배포 담당자에게 확인 요청합니다.
