import http from 'k6/http';
import {
    BASE_URL,
    authHeaders,
    authSetup,
    createEndpointMetrics,
    pauseBetweenIterations,
    recordResponse,
    summarize,
    testOptions,
} from './lib/common.js';

export const options = testOptions();
const metrics = createEndpointMetrics('review_like');
const reviewId = Number(__ENV.REVIEW_ID || '1');

export function setup() {
    return authSetup({ uniqueUsers: true });
}

export function handleSummary(data) {
    return summarize(data, 'review_like');
}

export default function (data) {
    const headers = authHeaders(data);

    // 매 반복이 실제 INSERT를 수행하도록 먼저 좋아요를 해제합니다. 이 준비 요청은 결과 지표에는
    // 넣지 않지만 서버 부하에는 포함되므로, 결과에는 "unlike + like 반복"이라고 기록해야 합니다.
    const cleanup = http.del(`${BASE_URL}/api/v1/reviews/${reviewId}/like`, null, {
        headers,
        tags: { name: 'review_like_prepare_unlike' },
    });
    if (cleanup.status !== 200) {
        recordResponse(metrics, cleanup, 200);
        pauseBetweenIterations();
        return;
    }

    const response = http.put(`${BASE_URL}/api/v1/reviews/${reviewId}/like`, null, {
        headers,
        tags: { name: 'review_like' },
    });
    recordResponse(metrics, response, 200, {
        'liked is true': (res) => {
            try {
                return res.json('liked') === true;
            } catch (_) {
                return false;
            }
        },
    });
    pauseBetweenIterations();
}
