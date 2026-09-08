# 운영 모니터링 및 Grafana 사용 가이드

## 1. 왜 사용하나요?

운영 서버에 직접 접속하지 않고 다음 상태를 빠르게 확인하기 위해 사용합니다.

- 현재 백엔드가 모니터링되고 있는지
- 트래픽이 언제 증가했는지
- 서버 오류가 언제 발생했는지
- 응답 시간이 느려진 시점이 있는지
- 문제가 발생한 시점에 어떤 예외가 있었는지

Grafana에서는 두 가지 정보를 사용합니다.

- **Dashboard**: 요청량, 오류율, 응답 시간처럼 숫자로 나타나는 상태 확인
- **Logs Drilldown**: 실제 오류 메시지와 Request ID 등 상세 원인 확인

```text
메트릭: Spring Boot → Alloy → Grafana Cloud → Dashboard
로그: Spring Boot stdout → Docker → Alloy → Loki → Logs Drilldown
```

메트릭과 로그는 서로 다른 데이터입니다. Dashboard에서 이상 시점을 찾은 뒤 Logs Drilldown에서 같은 시간대의 원인을 조사합니다.

`/actuator/prometheus`는 Alloy가 메트릭을 수집하는 경로입니다. 반복되는 수집 요청이 로그에 쌓이지 않도록 요청 로깅에서만 제외하며, 메트릭 수집 자체에는 영향을 주지 않습니다.

현재는 상태와 로그를 직접 조회하는 단계이며, 오류 발생 시 자동으로 알려주는 알림은 아직 구성하지 않았습니다.

---

## 2. 어디서 보나요?

Grafana Cloud 조직에 초대된 사용자만 접속할 수 있습니다. 팀원은 `Viewer` 권한으로 조회합니다. Alloy 토큰은 사용자 로그인용이 아니므로 공유하지 않습니다.

| 구분 | 운영 대시보드(Dashboard) | 운영 로그(Logs Drilldown) |
| --- | --- | --- |
| 목적 | 상태 감시 | 원인 조사 |
| 화면 | 미리 만든 패널 | 사용자가 조건을 바꾸며 탐색 |
| 예시 | 요청량, 5xx 오류율, p95 | 특정 시간의 ERROR 로그와 예외 |
| 사용법 | 시간 범위를 바꿔 확인 | 서비스·레벨·검색어·Request ID로 필터링 |

### 운영 대시보드

[Hyanghae Backend Operations](https://cleversubmarine1485.grafana.net/d/ebsqvsj/hyanghae-backend-operations)

### 운영 로그

[Grafana Logs Drilldown](https://cleversubmarine1485.grafana.net/a/grafana-lokiexplore-app/explore)

---

## 3. 대시보드는 어떻게 보나요?

1. 오른쪽 위에서 확인하려는 **시간 범위**를 선택합니다.
2. 실시간 확인 시 자동 새로고침을 `30초` 또는 `1분`으로 설정합니다.
3. 각 그래프에 마우스를 올리면 해당 시각의 정확한 값을 볼 수 있습니다.
4. 이상 구간이 발견되면 해당 시간대의 로그를 Logs Drilldown에서 확인합니다.

과거 상황을 확인하려면 `Last 6 hours`, `Last 24 hours` 또는 직접 지정한 시간 범위를 사용합니다.

---

## 4. 각 패널의 의미

| 패널 | 의미 | 확인할 내용 |
| --- | --- | --- |
| 초당 요청 수 | 최근 5분의 요청 수를 초 단위 평균으로 환산한 값 | 평소보다 트래픽이 급증하거나 끊긴 시점 |
| 5xx 오류율 | 전체 요청 중 서버 내부 오류가 발생한 비율 | 값이 0보다 높아진 시점 |
| p95 응답 시간 | 전체 요청 중 95%가 이 시간 이내에 처리된 값 | 평소보다 응답 시간이 크게 증가한 시점 |
| 백엔드 수집 상태 | Grafana가 백엔드 메트릭을 정상적으로 수집하는지 표시 | `정상`, `수집 실패`, `데이터 없음` |

### 초당 요청 수

X축은 시간, Y축은 초당 요청 수(`req/s`)입니다. 예를 들어 최근 5분 동안 요청이 300건이면 다음과 같습니다.

```text
300건 ÷ 300초 = 1 req/s
```

`/actuator/*`처럼 모니터링을 위한 내부 요청은 대시보드 집계에서 제외합니다.

### 5xx 오류율

HTTP 500번대 서버 오류의 비율입니다.

- `0%`: 확인된 서버 오류 없음
- `0% 초과`: 서버 오류 발생
- 갑자기 상승: 해당 시간대의 ERROR 로그 확인 필요

4xx는 잘못된 요청이나 인증·권한 실패도 포함하므로 이 패널에 포함하지 않습니다.

### p95 응답 시간

예를 들어 `p95 = 500ms`라면 요청 100건 중 약 95건이 500ms 이내에 처리됐다는 뜻입니다.

값이 상승하면 다음 원인을 의심할 수 있습니다.

- DB 또는 Redis 지연
- 외부 API 지연
- 서버 리소스 부족
- 특정 API 처리 지연

요청이 없으면 `No data`가 표시될 수 있습니다.

### 백엔드 수집 상태

- `정상`: Alloy가 백엔드 메트릭을 수집 중
- `수집 실패`: 백엔드 메트릭 주소에 접근하지 못함
- `데이터 없음`: Alloy 또는 Grafana 전송 상태 확인 필요

`정상`은 모니터링 연결 상태를 의미하며, 모든 서비스 기능이 정상이라는 뜻은 아닙니다.

---

## 5. 로그는 어떻게 보나요?

1. 오른쪽 위에서 오류가 발생한 **시간 범위**를 선택합니다.
2. **Labels → service**에서 `hyanghae-backend`를 필터링한 뒤 **Show logs**를 선택합니다.
3. `ERROR`를 먼저 확인하고 필요하면 `WARN`까지 확인합니다.
4. 검색창에 오류 메시지나 `requestId`를 입력합니다.
5. 로그 한 줄을 선택해 발생 전후의 로그를 함께 확인합니다.

자주 사용하는 검색어는 다음과 같습니다.

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

### 백엔드 로그 읽는 법

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

### Request ID로 추적하기

백엔드는 `/actuator/prometheus`를 제외한 HTTP 응답에 `X-Request-ID` 헤더를 제공합니다.

1. 브라우저 개발자 도구의 **Network** 탭을 엽니다.
2. 실패한 API 요청을 선택합니다.
3. **Response Headers**에서 `X-Request-ID`를 확인합니다.
4. 해당 값을 Grafana 검색창에 입력합니다.

같은 요청에서 발생한 로그를 한꺼번에 찾을 수 있습니다.

---

## 6. 문제가 발견되면 어떻게 하나요?

### 5xx 오류율이 상승한 경우

1. 오류율이 상승한 시각을 확인합니다.
2. Logs Drilldown으로 이동합니다.
3. **Labels → service → `hyanghae-backend`**를 선택합니다.
4. 같은 시간 범위를 설정합니다.
5. `ERROR`와 `Unhandled HTTP request exception`을 검색합니다.
6. Request ID가 있다면 해당 값으로 관련 로그를 추적합니다.

### p95 응답 시간만 상승한 경우

오류는 없지만 처리가 느려진 상태일 수 있습니다.

1. 같은 시각의 요청량을 확인합니다.
2. 백엔드 WARN·ERROR 로그를 확인합니다.
3. 필요하면 PostgreSQL, Redis 및 외부 API 상태를 확인합니다.

### 요청량과 오류율이 함께 상승한 경우

트래픽 증가로 인해 서버가 요청을 처리하지 못했을 가능성이 있습니다. 요청 증가 시점과 오류 발생 시점이 일치하는지 확인합니다.

### 수집 상태가 정상이 아닌 경우

백엔드 컨테이너 또는 Alloy 상태를 배포 담당자에게 확인 요청합니다.

### 배포 직후 확인

백엔드 수집 상태가 `정상`인지 확인한 뒤 다음 로그와 새로운 `ERROR` 발생 여부를 확인합니다.

```text
Started BackendApplication
Tomcat started on port 8080
path=/actuator/health, status=200
```

---

## 7. 오류 제보 시 전달할 정보

- 오류 발생 시각과 시간대
- 수행한 기능
- 호출한 API
- HTTP 상태 코드
- `X-Request-ID`
- 재현 순서
- 대시보드에서 오류율 또는 응답 시간이 상승했는지 여부

---

## 8. 보안 주의사항

비밀번호, 인증 헤더, API 토큰, 개인정보 및 요청·응답 본문 전체는 로그나 공유 문서에 남기지 않습니다. Alloy 토큰과 운영 서버 설정 파일도 공유하지 않습니다.

---

## 9. 데이터가 보이지 않을 때

1. 시간 범위를 `Last 1 hour` 이상으로 넓힙니다.
2. 운영 API를 한 번 호출하고 Grafana를 새로고침합니다.
3. 대시보드만 비어 있으면 백엔드 수집 상태와 Alloy의 메트릭 수집·전송 상태를 확인합니다.
4. 로그만 보이지 않으면 백엔드 컨테이너의 stdout과 Alloy의 로그 수집·전송 상태를 확인합니다.
5. 계속 보이지 않으면 배포 담당자에게 확인을 요청합니다.
