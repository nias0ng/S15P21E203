// 향수 상세의 후기 집계를 <b>화면 단위로</b> 측정합니다.
//
// 상세 진입 한 번이 실제로는 여러 요청이 됩니다. 개별로 재면 다 빠른데 화면은 느릴 수 있어
// search-screen-with-images.js 와 같은 방식으로 한 화면이 보내는 요청을 묶어서 봅니다.
// 브라우저처럼 http.batch 로 병렬 요청하므로, 순서대로 재서 우리 스크립트의 직렬성을
// 측정하는 일이 없습니다.
//
// 재는 방식이 둘입니다. MERGED 로 고릅니다.
//
//   MERGED=false (기본)  넷을 따로 부릅니다. 표가 다섯 개 — 앞의 넷은 API 별 수치,
//                        마지막 perfume_detail_screen 은 화면 한 장이 완성되기까지 걸린 시간
//   MERGED=true          review-aggregates 하나만 부릅니다. 표는 perfume_detail_screen 하나
//
// <b>두 방식의 perfume_detail_screen 표를 그대로 견주면 됩니다.</b> 화면 한 장을 세는 기준이
// 같고 VU 단계·지속 시간·think time 도 같습니다. 그래서 통합의 효과만 차이로 남습니다.
//
//   k6 run -e MODE=smoke -e PERFUME_ID=3 performance/perfume-detail-aggregates.js
//   k6 run -e MODE=load -e PERFUME_ID=135 -e BASE_URL=https://운영-주소 performance/perfume-detail-aggregates.js
//   k6 run -e MODE=load -e PERFUME_ID=135 -e MERGED=true -e BASE_URL=https://운영-주소 performance/perfume-detail-aggregates.js
import http from 'k6/http';
import {
    BASE_URL,
    createEndpointMetrics,
    pauseBetweenIterations,
    recordResponse,
    summarize,
    testOptions,
} from './lib/common.js';

export const options = testOptions('perfume_detail_screen');

// 후기 집계가 실제로 들어 있는 향수를 줘야 합니다. 빈 향수를 주면 요청이 모두 빈 응답을
// 즉시 돌려주어 집계 비용이 빠진 수치가 나옵니다.
const perfumeId = Number(__ENV.PERFUME_ID || '3');

// 통합 엔드포인트로 잴지 여부입니다. 'true' 한 값만 켜짐으로 봅니다 — 오타로 켜지면 전후
// 비교를 반대로 읽게 됩니다.
const merged = (__ENV.MERGED || 'false').toLowerCase() === 'true';

const ENDPOINTS = [
    { name: 'review_summary', path: 'review-summary' },
    { name: 'review_keywords', path: 'review-keywords' },
    { name: 'review_statistics', path: 'review-statistics' },
    { name: 'season_statistics', path: 'season-statistics' },
];

// 따로 부를 때만 API 별 지표를 만듭니다. 통합에서는 API 가 하나라 화면 지표와 같은 값이 되고,
// 같은 수치를 표 두 개로 내면 어느 쪽을 봐야 하는지가 흐려집니다.
const metrics = {};
if (!merged) {
    ENDPOINTS.forEach((endpoint) => {
        metrics[endpoint.name] = createEndpointMetrics(endpoint.name);
    });
}

// 화면 전체를 한 건으로 세는 지표입니다. 따로 부를 때는 요청 중 가장 늦게 끝난 것을 화면
// 완성 시각으로 봅니다 — 병렬로 보내므로 합이 아니라 최댓값이 맞습니다.
const screenMetrics = createEndpointMetrics('perfume_detail_screen');

export function handleSummary(data) {
    const names = merged
        ? ['perfume_detail_screen']
        : [...ENDPOINTS.map((endpoint) => endpoint.name), 'perfume_detail_screen'];
    return { stdout: names.map((name) => summarize(data, name).stdout).join('') };
}

export default function () {
    if (merged) {
        measureMerged();
    } else {
        measureSeparate();
    }

    pauseBetweenIterations();
}

/** 통합 엔드포인트 한 번이 곧 화면 한 장입니다. */
function measureMerged() {
    const response = http.get(
        `${BASE_URL}/api/v1/perfumes/${perfumeId}/review-aggregates`,
        { tags: { name: 'perfume_detail_screen' } },
    );

    // 네 조각이 다 들어 있는지 봅니다. 하나라도 빠지면 화면이 그 칸을 못 그리므로, 응답이
    // 빨라도 화면이 완성된 것이 아닙니다. 상태 코드만 보면 이것을 놓칩니다.
    recordResponse(screenMetrics, response, 200, {
        'contains all four parts': (res) => {
            try {
                const body = res.json();
                return body.reviewSummary !== undefined
                    && Array.isArray(body.reviewKeywords.keywords)
                    && body.reviewStatistics.reviewCount !== undefined
                    && Array.isArray(body.seasonStatistics.seasons);
            } catch (_) {
                return false;
            }
        },
    });
}

/** 넷을 병렬로 부르고, 가장 늦게 끝난 것을 화면 완성 시각으로 봅니다. */
function measureSeparate() {
    const requests = ENDPOINTS.map((endpoint) => [
        'GET',
        `${BASE_URL}/api/v1/perfumes/${perfumeId}/${endpoint.path}`,
        null,
        { tags: { name: endpoint.name } },
    ]);

    const responses = http.batch(requests);

    let slowest = responses[0];
    responses.forEach((response, index) => {
        recordResponse(metrics[ENDPOINTS[index].name], response, 200);
        if (response.timings.duration > slowest.timings.duration) {
            slowest = response;
        }
    });

    // 하나라도 200 이 아니면 화면이 깨진 것으로 봅니다. 기대 상태를 0 으로 주면 어떤 응답도
    // 맞지 않으므로 그 반복이 실패로 기록됩니다.
    const allOk = responses.every((response) => response.status === 200);
    recordResponse(screenMetrics, slowest, allOk ? 200 : 0);
}
