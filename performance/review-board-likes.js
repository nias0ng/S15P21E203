import http from 'k6/http';
import {
    BASE_URL,
    createEndpointMetrics,
    pauseBetweenIterations,
    recordResponse,
    summarize,
    testOptions,
} from './lib/common.js';

export const options = testOptions();
const metrics = createEndpointMetrics('review_board_likes');
const pageSize = __ENV.PAGE_SIZE || '20';

export default function () {
    const response = http.get(
        `${BASE_URL}/api/v1/reviews?sort=LIKES&page=0&size=${pageSize}`,
        { tags: { name: 'review_board_likes' } },
    );
    recordResponse(metrics, response, 200, {
        'reviews is an array': (res) => {
            try {
                return Array.isArray(res.json('reviews'));
            } catch (_) {
                return false;
            }
        },
    });
    pauseBetweenIterations();
}

export function handleSummary(data) {
    return summarize(data, 'review_board_likes');
}
