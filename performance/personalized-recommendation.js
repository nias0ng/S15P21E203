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
const metrics = createEndpointMetrics('personalized_recommendation');

export function setup() {
    return authSetup({ uniqueUsers: true });
}

export default function (data) {
    const response = http.get(`${BASE_URL}/api/v1/recommendations/personalized`, {
        headers: authHeaders(data),
        tags: { name: 'personalized_recommendation' },
    });
    recordResponse(metrics, response, 200, {
        'recommendation contains perfume': (res) => {
            try {
                return Number(res.json('recommendation.perfumeId')) > 0;
            } catch (_) {
                return false;
            }
        },
    });
    pauseBetweenIterations();
}

export function handleSummary(data) {
    return summarize(data, 'personalized_recommendation');
}
