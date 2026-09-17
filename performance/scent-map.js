import http from 'k6/http';
import { check } from 'k6';
import { Trend } from 'k6/metrics';

// 향 지도 조회의 응답 시간과 페이로드 크기를 봅니다.
//
// 지도는 조건 없이 전체를 내려주는 엔드포인트라 응답 크기가 고정에 가깝습니다. 그래서 응답
// 시간뿐 아니라 본문 크기도 함께 기록합니다. 지도에 올리는 향수를 늘리거나 계열 폴리곤을
// 다시 만들었을 때, 크기가 얼마나 달라졌는지 같은 조건에서 비교하려는 것입니다.
//
// 실행 방법은 backend/docs/performance-testing.md 를 따릅니다.
//   k6 run performance/scent-map.js
//   k6 run -e BASE_URL=http://localhost:8081 performance/scent-map.js
//
// 수동 테스트 환경에 향 지도 시드가 적재돼 있어야 합니다(계열 9개, 향수 200개).
// 적재 방법은 backend/db/seed/README.md 에 있습니다.

const mapPayloadBytes = new Trend('map_payload_bytes');

export const options = {
    vus: 1,
    iterations: 50,
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:8080';

export default function () {
    const map = http.get(`${BASE_URL}/api/v1/map`);
    mapPayloadBytes.add(map.body.length);

    check(map, {
        'map: status is 200': (res) => res.status === 200,
        'map: 계열 9개': (res) => res.json('regions').length === 9,
        'map: 향수 200개': (res) => res.json('perfumes').length === 200,
    });

    // 지도에서 점을 눌렀을 때 나가는 요청입니다. 향수 하나라 응답이 작습니다.
    const perfume = http.get(`${BASE_URL}/api/v1/map/perfumes/3`);

    check(perfume, {
        'perfume: status is 200': (res) => res.status === 200,
    });
}
