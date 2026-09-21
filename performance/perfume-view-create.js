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

export const options = testOptions('perfume_view_create');
const metrics = createEndpointMetrics('perfume_view_create');
const perfumeId = Number(__ENV.PERFUME_ID || '3');
const sourceType = __ENV.VIEW_SOURCE || 'SEARCH';

export function setup() {
    return authSetup();
}

export function handleSummary(data) {
    return summarize(data, 'perfume_view_create');
}

export default function (data) {
    const response = http.post(
        `${BASE_URL}/api/v1/perfume-views`,
        JSON.stringify({
            perfumeId,
            fromLocationType: sourceType,
            fromPerfumeId: null,
        }),
        {
            headers: authHeaders(data),
            tags: { name: 'perfume_view_create' },
        },
    );
    recordResponse(metrics, response, 201, {
        'view id is returned': (res) => {
            try {
                return Number(res.json('perfumeViewId')) > 0;
            } catch (_) {
                return false;
            }
        },
    });
    pauseBetweenIterations();
}
