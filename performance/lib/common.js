import http from 'k6/http';
import { check, fail, sleep } from 'k6';
import exec from 'k6/execution';
import { Counter, Rate, Trend } from 'k6/metrics';

export const BASE_URL = (__ENV.BASE_URL || 'http://localhost:8080').replace(/\/$/, '');
export const MODE = (__ENV.MODE || 'smoke').toLowerCase();
export const LOAD_LEVELS = [5, 10, 20, 30, 50];

const stageSeconds = positiveInteger(__ENV.STAGE_SECONDS || '60', 'STAGE_SECONDS');
const thinkTimeSeconds = nonNegativeNumber(__ENV.THINK_TIME_SECONDS || '0', 'THINK_TIME_SECONDS');

export function testOptions() {
    if (MODE === 'smoke') {
        return {
            vus: 1,
            iterations: 1,
            discardResponseBodies: false,
        };
    }
    if (MODE !== 'load') {
        throw new Error(`MODE는 smoke 또는 load여야 합니다. 현재 값: ${MODE}`);
    }

    const scenarios = {};
    LOAD_LEVELS.forEach((vus, index) => {
        scenarios[`vu_${vus}`] = {
            executor: 'constant-vus',
            vus,
            duration: `${stageSeconds}s`,
            startTime: `${index * stageSeconds}s`,
            gracefulStop: '0s',
        };
    });
    return { scenarios, discardResponseBodies: false };
}

export function createEndpointMetrics(testName) {
    const normalized = testName.replace(/-/g, '_');
    const result = {};
    const levels = MODE === 'smoke' ? ['smoke'] : LOAD_LEVELS.map(String);
    levels.forEach((level) => {
        result[level] = {
            requests: new Counter(`${normalized}_vu_${level}_requests`),
            duration: new Trend(`${normalized}_vu_${level}_duration`, true),
            failures: new Rate(`${normalized}_vu_${level}_failure_rate`),
        };
    });
    return result;
}

export function recordResponse(metrics, response, expectedStatus, checks = {}) {
    const level = currentLevel();
    const selected = metrics[level];
    const passed = check(response, {
        [`status is ${expectedStatus}`]: (res) => res.status === expectedStatus,
        ...checks,
    });
    selected.requests.add(1);
    selected.duration.add(response.timings.duration);
    selected.failures.add(!passed);
}

export function authSetup({ uniqueUsers = false } = {}) {
    let tokens = csv(__ENV.ACCESS_TOKENS);
    if (tokens.length === 0) {
        tokens = loginTestUsers();
    }

    const required = MODE === 'load' && uniqueUsers ? Math.max(...LOAD_LEVELS) : 1;
    if (tokens.length < required) {
        fail(`${required}개의 서로 다른 테스트 사용자 토큰이 필요하지만 ${tokens.length}개만 있습니다.`);
    }
    return { tokens };
}

export function authHeaders(data) {
    if (!data || !Array.isArray(data.tokens) || data.tokens.length === 0) {
        fail('인증 토큰이 없습니다. ACCESS_TOKENS 또는 테스트 계정 환경변수를 확인하세요.');
    }
    const token = data.tokens[(__VU - 1) % data.tokens.length];
    return {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
    };
}

export function pauseBetweenIterations() {
    if (thinkTimeSeconds > 0) {
        sleep(thinkTimeSeconds);
    }
}

export function summarize(data, testName) {
    const normalized = testName.replace(/-/g, '_');
    const levels = MODE === 'smoke' ? ['smoke'] : LOAD_LEVELS.map(String);
    const rows = levels.map((level) => {
        const requests = metricValue(data, `${normalized}_vu_${level}_requests`, 'count');
        const p95 = metricValue(data, `${normalized}_vu_${level}_duration`, 'p(95)');
        const failureRate = metricValue(
            data,
            `${normalized}_vu_${level}_failure_rate`,
            'rate',
        );
        const seconds = MODE === 'smoke'
            ? Math.max(data.state.testRunDurationMs / 1000, 0.001)
            : stageSeconds;
        return {
            vu: level === 'smoke' ? '1(smoke)' : level,
            rps: requests / seconds,
            p95,
            failureRate,
            requests,
        };
    });

    const lines = [
        '',
        `=== ${testName} K6 RESULT ===`,
        'VU       RPS        p95(ms)    error(%)   requests',
        '-------------------------------------------------',
        ...rows.map((row) => [
            row.vu.padEnd(8),
            row.rps.toFixed(2).padStart(10),
            row.p95.toFixed(2).padStart(11),
            (row.failureRate * 100).toFixed(2).padStart(11),
            String(row.requests).padStart(11),
        ].join('')),
        '',
    ];
    return { stdout: `${lines.join('\n')}\n` };
}

function loginTestUsers() {
    const password = __ENV.TEST_PASSWORD;
    if (!password) {
        fail('ACCESS_TOKENS가 없으면 TEST_PASSWORD가 필요합니다. 비밀번호는 파일에 저장하지 마세요.');
    }

    const emails = testUserEmails();
    const tokens = [];
    emails.forEach((email) => {
        const response = http.post(
            `${BASE_URL}/api/v1/auth/login`,
            JSON.stringify({ email, password }),
            {
                headers: { 'Content-Type': 'application/json' },
                tags: { name: 'setup_login' },
            },
        );
        const ok = check(response, {
            [`setup login succeeds: ${email}`]: (res) => res.status === 200,
            [`setup login returns token: ${email}`]: (res) => {
                try {
                    return Boolean(res.json('accessToken'));
                } catch (_) {
                    return false;
                }
            },
        });
        if (!ok) {
            fail(`테스트 계정 로그인 실패: ${email}, status=${response.status}`);
        }
        tokens.push(response.json('accessToken'));
    });
    return tokens;
}

function testUserEmails() {
    const explicit = csv(__ENV.TEST_USER_EMAILS);
    if (explicit.length > 0) {
        return explicit;
    }
    if (__ENV.TEST_USER_EMAIL) {
        return [__ENV.TEST_USER_EMAIL];
    }

    const count = positiveInteger(
        __ENV.TEST_USER_COUNT || (MODE === 'load' ? '50' : '1'),
        'TEST_USER_COUNT',
    );
    const start = positiveInteger(__ENV.TEST_USER_START || '41', 'TEST_USER_START');
    const prefix = __ENV.TEST_USER_PREFIX || 'demo';
    const domain = __ENV.TEST_USER_DOMAIN || '@demo.hyanghae.test';
    return Array.from({ length: count }, (_, index) => {
        const number = String(start + index).padStart(2, '0');
        return `${prefix}${number}${domain}`;
    });
}

function currentLevel() {
    if (MODE === 'smoke') {
        return 'smoke';
    }
    const match = /^vu_(\d+)$/.exec(exec.scenario.name);
    if (!match) {
        throw new Error(`VU 구간을 알 수 없는 scenario입니다: ${exec.scenario.name}`);
    }
    return match[1];
}

function metricValue(data, name, property) {
    const metric = data.metrics[name];
    if (!metric || !metric.values || metric.values[property] === undefined) {
        return 0;
    }
    return Number(metric.values[property]);
}

function csv(value) {
    return (value || '').split(',').map((item) => item.trim()).filter(Boolean);
}

function positiveInteger(value, name) {
    const parsed = Number(value);
    if (!Number.isInteger(parsed) || parsed <= 0) {
        throw new Error(`${name}은 양의 정수여야 합니다. 현재 값: ${value}`);
    }
    return parsed;
}

function nonNegativeNumber(value, name) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed < 0) {
        throw new Error(`${name}은 0 이상의 숫자여야 합니다. 현재 값: ${value}`);
    }
    return parsed;
}
