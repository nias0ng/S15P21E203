# k6 간이 성능 테스트 가이드

이 문서는 개발 중 API 변경 전후의 응답 시간을 같은 조건에서 간단히 비교하는 방법을 설명합니다. 시스템의 최대 처리량을 측정하는 정식 부하 테스트와는 목적이 다릅니다.

## 1. 설치

k6는 성능 관련 작업을 수행할 때만 설치하는 선택 도구입니다.

### Windows

```powershell
winget install k6 --source winget
```

### macOS

```bash
brew install k6
```

설치 후 버전을 확인합니다.

```bash
k6 version
```

다른 운영체제의 설치 방법은 [k6 공식 설치 문서](https://grafana.com/docs/k6/latest/set-up/install-k6/)를 참고합니다.

## 2. 테스트 파일 작성

저장소 루트의 `performance` 디렉터리에 테스트할 API별로 파일을 작성합니다.

```text
performance/
├─ perfume-detail.js
├─ perfume-map.js
└─ recommendation.js
```

```javascript
import http from 'k6/http';
import { check } from 'k6';

export const options = {
    vus: 1,
    iterations: 50,
};

export default function () {
    const response = http.get('http://localhost:8080/api/perfumes/123');

    check(response, {
        'status is 200': (res) => res.status === 200,
    });
}
```

- `vus`: 동시에 요청을 보내는 가상 사용자 수
- `iterations`: 전체 요청 반복 횟수
- `check`: 응답이 기대한 상태인지 검증하는 조건

개발 중 단순 전후 비교는 기본적으로 가상 사용자 1명과 요청 50회를 사용합니다.

```javascript
vus: 1,
iterations: 50
```

JS 작성이 익숙하지 않다면 테스트할 API의 Method, URL, Header, Body를 AI에게 전달하고 k6 코드 생성을 요청할 수 있습니다.

```text
다음 API를 k6로 50회 반복 테스트하는 JS 코드를 작성해줘.

Method: POST
URL: http://localhost:8080/api/recommendations
Header:
Authorization: Bearer {token}

Body:
{
  "query": "포근하고 깨끗한 향 추천해줘"
}

VU는 1로 설정해줘.
```

실제 인증 토큰이나 비밀값은 테스트 파일에 작성하거나 Git에 커밋하지 않습니다.

## 3. 테스트 실행

먼저 수동 테스트 환경과 백엔드 서버를 실행합니다. 그다음 저장소 루트에서 k6를 실행합니다.

```bash
k6 run performance/perfume-detail.js
```

k6가 테스트 파일에 설정된 횟수만큼 API를 호출합니다.

## 4. 결과 확인

결과에서 `http_req_duration` 항목을 확인합니다.

```text
http_req_duration
avg=132ms med=118ms p(90)=160ms p(95)=185ms max=280ms
```

변경 전후를 비교할 때는 우선 다음 두 값을 기록합니다.

| 지표 | 의미 |
| --- | --- |
| `med` | 응답 시간 중앙값 |
| `p(95)` | 전체 요청 중 95%가 완료된 응답 시간 |

```text
변경 전
med: 210ms
p(95): 340ms

변경 후
med: 125ms
p(95): 180ms
```

요청 성공 여부를 확인하기 위해 `checks`와 `http_req_failed` 결과도 함께 확인합니다. 실패한 요청이 포함된 응답 시간만으로 성능 개선을 판단하지 않습니다.

## 5. 개발 중 사용 순서

1. 수동 테스트 환경과 백엔드 서버를 실행합니다.
2. 테스트할 API를 몇 번 호출해 워밍업합니다.
3. k6를 실행합니다.
4. `med`와 `p(95)`를 기록합니다.
5. 코드 또는 DB 구조를 변경합니다.
6. 동일한 k6 파일을 다시 실행합니다.
7. 변경 전후 수치를 비교합니다.

성능 비교 시에는 다음 조건을 동일하게 유지합니다.

- API 및 요청 데이터
- DB와 Redis의 데이터 상태
- k6의 `vus` 및 `iterations`
- 실행 PC와 백엔드 실행 환경

팀과 사전 협의 없이 운영 서버를 대상으로 성능 테스트를 실행하지 않습니다.
