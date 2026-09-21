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
const metrics = createEndpointMetrics('shelf_items');
const category = __ENV.SHELF_CATEGORY || 'OWNED';
const pageSize = __ENV.PAGE_SIZE || '20';

export function setup() {
    return authSetup();
}

export function handleSummary(data) {
    return summarize(data, 'shelf_items');
}

export default function (data) {
    const response = http.get(
        `${BASE_URL}/api/v1/users/me/shelf-items?category=${category}&page=0&size=${pageSize}`,
        {
            headers: authHeaders(data),
            tags: { name: 'shelf_items' },
        },
    );
    recordResponse(metrics, response, 200, {
        'shelf items is an array': (res) => {
            try {
                return Array.isArray(res.json('perfumes'));
            } catch (_) {
                return false;
            }
        },
    });
    pauseBetweenIterations();
}
