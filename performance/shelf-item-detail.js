import http from 'k6/http';
import { fail } from 'k6';
import {
    BASE_URL,
    LOAD_LEVELS,
    MODE,
    authHeaders,
    authSetup,
    createEndpointMetrics,
    pauseBetweenIterations,
    recordResponse,
    summarize,
    testOptions,
} from './lib/common.js';

export const options = testOptions('shelf_item_detail');
const metrics = createEndpointMetrics('shelf_item_detail');

export function setup() {
    const auth = authSetup({ uniqueUsers: true });
    const shelfItemIds = (__ENV.SHELF_ITEM_IDS || __ENV.SHELF_ITEM_ID || '')
        .split(',')
        .map((value) => Number(value.trim()))
        .filter((value) => Number.isInteger(value) && value > 0);
    const required = MODE === 'load' ? Math.max(...LOAD_LEVELS) : 1;
    if (shelfItemIds.length < required) {
        fail(`${required}개의 사용자별 SHELF_ITEM_IDS가 필요하지만 ${shelfItemIds.length}개만 있습니다.`);
    }
    return { ...auth, shelfItemIds };
}

export default function (data) {
    const shelfItemId = data.shelfItemIds[(__VU - 1) % data.shelfItemIds.length];
    const response = http.get(
        `${BASE_URL}/api/v1/users/me/shelf-items/${shelfItemId}`,
        {
            headers: authHeaders(data),
            tags: { name: 'shelf_item_detail' },
        },
    );
    recordResponse(metrics, response, 200, {
        'shelf item belongs to selected id': (res) => {
            try {
                return Number(res.json('shelfItemId')) === shelfItemId;
            } catch (_) {
                return false;
            }
        },
        'personal memo is returned': (res) => {
            try {
                return String(res.json('memo') || '').length > 0;
            } catch (_) {
                return false;
            }
        },
    });
    pauseBetweenIterations();
}

export function handleSummary(data) {
    return summarize(data, 'shelf_item_detail');
}
