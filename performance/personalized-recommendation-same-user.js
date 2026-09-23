import http from 'k6/http';
import { Counter } from 'k6/metrics';
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

export const options = testOptions('personalized_recommendation_same_user');
const metrics = createEndpointMetrics('personalized_recommendation_same_user');
const refreshConflicts = new Counter('personalized_recommendation_refresh_conflicts');

export function setup() {
    return authSetup({ uniqueUsers: false });
}

export default function (data) {
    const response = http.get(`${BASE_URL}/api/v1/recommendations/personalized`, {
        headers: authHeaders(data),
        tags: { name: 'personalized_recommendation_same_user' },
    });
    if (response.status === 409
        && response.json('code') === 'RECOMMENDATION_REFRESH_IN_PROGRESS') {
        refreshConflicts.add(1);
    }
    recordResponse(metrics, response, [200, 409], {
        'returns recommendation or refresh conflict': (res) => {
            if (res.status === 200) {
                return Number(res.json('recommendation.perfumeId')) > 0;
            }
            return res.status === 409
                && res.json('code') === 'RECOMMENDATION_REFRESH_IN_PROGRESS';
        },
    });
    pauseBetweenIterations();
}

export function handleSummary(data) {
    const result = summarize(data, 'personalized_recommendation_same_user');
    const conflicts = data.metrics.personalized_recommendation_refresh_conflicts
        ?.values?.count ?? 0;
    result.stdout += `refresh conflicts: ${conflicts}\n`;
    return result;
}
