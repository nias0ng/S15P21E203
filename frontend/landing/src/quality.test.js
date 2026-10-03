// ───────── 품질 단계 — 최저(min) 단계의 계약 (2026-09-30) ─────────
//   quality.js 는 GPU 이름 · 프레임 간격만 보고 단계를 고른다. 여기서는 가짜 gl(렌더러 이름만 · 타이머 없음)로 그 판정을 돌린다.
//   잡는 것 :
//   · 소프트웨어 렌더링이 최저에서, 내장 GPU 가 낮음에서 시작한다
//   · 최저의 손잡이(픽셀비 하한 · 가벼운 물 · 부력 읽기 · 반짝임 거품 · 30fps)가 params · bundle 로 나간다 — 다른 단계로 돌아오면 high 의 값이다
//   · 낮음에서 끊기면 최저로 내려가고, 최저의 30fps 상한에 묶인 간격(33ms)을 '느리다'로 읽지 않는다

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { PARAMS } from './params.js';
import { createQuality, TIERS } from './quality.js';

const P0 = { ...PARAMS };
const fakeGl = (renderer) => ({
  RENDERER: 0x1f01,
  getExtension: (name) => (name === 'WEBGL_debug_renderer_info' ? { UNMASKED_RENDERER_WEBGL: 0x9246 } : null),
  getParameter: () => renderer,
});
// GPU 타이머까지 있는 가짜 gl — 한 장의 GPU 시간이 늘 gpuMs 다
const timerGl = (renderer, gpu) => {
  const ext = { TIME_ELAPSED_EXT: 0x88bf, GPU_DISJOINT_EXT: 0x8fbb };
  let open = null;   // 지금 열린 쿼리 — quality.js 는 남의 쿼리가 열려 있으면 비킨다
  return {
    RENDERER: 0x1f01, CURRENT_QUERY: 0x8865, QUERY_RESULT: 0x8866, QUERY_RESULT_AVAILABLE: 0x8867,
    getExtension: (name) => (name === 'WEBGL_debug_renderer_info' ? { UNMASKED_RENDERER_WEBGL: 0x9246 }
      : name === 'EXT_disjoint_timer_query_webgl2' ? ext : null),
    getParameter: (p) => (p === ext.GPU_DISJOINT_EXT ? false : renderer),
    getQuery: () => open, createQuery: () => ({}), deleteQuery: () => {},
    beginQuery: (t, q) => { open = q; }, endQuery: () => { open = null; },
    getQueryParameter: (q, p) => (p === 0x8867 ? true : gpu.ms * 1e6),
  };
};
const setDpr = (d) => Object.defineProperty(window, 'devicePixelRatio', { configurable: true, get: () => d });

// 판정 창을 여러 번 채운다. 부팅 쉼(6초)을 넘긴 시각부터 간격 ms 로 n 장
function feed(q, ms, n, start) {
  let t = start;
  for (let i = 0; i < n; i++) { t += ms; q.frameBegin(); q.frameEnd(t); }
  return t;
}

beforeEach(() => { localStorage.clear(); setDpr(1); });
afterEach(() => { Object.assign(PARAMS, P0); localStorage.clear(); });

describe('시작 단계', () => {
  it('소프트웨어 렌더링은 최저, 내장 그래픽은 낮음에서 시작한다', () => {
    expect(createQuality({ gl: fakeGl('ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero)))') }).tier).toBe('min');
    expect(createQuality({ gl: fakeGl('ANGLE (Microsoft, Microsoft Basic Render Driver Direct3D11)') }).tier).toBe('min');
    expect(createQuality({ gl: fakeGl('ANGLE (Intel, Intel(R) UHD Graphics 620 Direct3D11)') }).tier).toBe('low');
    expect(createQuality({ gl: fakeGl('ANGLE (NVIDIA, NVIDIA GeForce RTX 4050 Laptop GPU Direct3D11)') }).tier).toBe('high');
  });

  it('설정에서 최저를 고르면 그 단계에 고정된다', () => {
    const q = createQuality({ gl: fakeGl('Intel(R) Arc(TM) Graphics') });
    q.setMode('min');
    expect(q.info()).toMatchObject({ mode: 'min', tier: 'min', auto: false, label: '최저' });
  });
});

describe('최저의 손잡이', () => {
  it('픽셀비는 화면 배율 × 0.6 · 상한 0.75 · 하한 0.5 다 (다른 단계의 하한은 0.6 그대로)', () => {
    const q = createQuality({ gl: fakeGl('Intel(R) Arc(TM) Graphics') });
    q.setMode('min');
    setDpr(1); expect(q.pixelRatio()).toBeCloseTo(0.6);
    setDpr(1.25); expect(q.pixelRatio()).toBeCloseTo(0.75);
    setDpr(2); expect(q.pixelRatio()).toBeCloseTo(0.75);
    setDpr(0.5); expect(q.pixelRatio()).toBeCloseTo(0.5);
    q.setMode('low');
    setDpr(0.5); expect(q.pixelRatio()).toBeCloseTo(0.6);
  });

  it('가벼운 물 · 부력 읽기 · 반짝임 거품 · 30fps 는 최저에서만 켜지고, 돌아오면 high 의 값이다', () => {
    const spark = PARAMS.sparkAmount;
    const q = createQuality({ gl: fakeGl('Intel(R) Arc(TM) Graphics') });
    q.setMode('min'); q.writeParams();
    expect(PARAMS).toMatchObject({ waterLite: 1, buoyProbe: 0, sparkAmount: 0 });
    expect(q.bundle().fps).toBe(30);
    for (const tier of ['low', 'mid', 'high']) {
      q.setMode(tier); q.writeParams();
      expect(PARAMS).toMatchObject({ waterLite: 0, buoyProbe: 1, sparkAmount: spark });
      expect(TIERS[tier].fps || 0).toBe(0);
    }
  });
});

describe('자동 판정', () => {
  it('낮음에서 끊기면(간격 40ms) 최저로 내려간다', () => {
    const q = createQuality({ gl: fakeGl('Intel(R) UHD Graphics 620') });
    const seen = [];
    q.onChange((i) => seen.push(`${i.tier}:${i.reason}`));
    feed(q, 40, 600, performance.now() + 10000);
    expect(q.tier).toBe('min');
    expect(seen).toContain('min:down');
  });

  it('최저의 30fps 상한에 묶인 간격은 느린 것이 아니다 — 상한의 1.5배(50ms)를 넘을 때만 느리다고 알린다', () => {
    const q = createQuality({ gl: fakeGl('Intel(R) UHD Graphics 620') });
    q.setMode('auto');
    const seen = [];
    q.onChange((i) => seen.push(i.reason));
    let t = feed(q, 40, 600, performance.now() + 10000);   // 낮음 → 최저
    expect(q.tier).toBe('min');
    seen.length = 0;
    t = feed(q, 34, 900, t + 10000);                        // 30fps 상한 그대로
    expect(q.tier).toBe('min');
    expect(seen).not.toContain('slow');
    feed(q, 60, 600, t + 10000);                            // 상한 아래로도 밀린다
    expect(seen).toContain('slow');
  });

  it('GPU 타이머가 있어도 30fps 를 지키고 있는 최저(GPU 20ms)를 느리다고 알리지 않는다', () => {
    const gpu = { ms: 20 };
    const q = createQuality({ gl: timerGl('ANGLE (Google, SwiftShader Device)', gpu) });
    expect(q.tier).toBe('min');
    const seen = [];
    q.onChange((i) => seen.push(i.reason));
    feed(q, 34, 900, performance.now() + 10000);
    expect(q.tier).toBe('min');
    expect(seen).not.toContain('slow');
  });

  it('최저에서 GPU 에 여유가 있으면(3ms) 30fps 간격이어도 낮음으로 올린다', () => {
    const gpu = { ms: 3 };
    const q = createQuality({ gl: timerGl('ANGLE (Google, SwiftShader Device)', gpu) });
    feed(q, 34, 900, performance.now() + 10000);
    expect(q.tier).toBe('low');
  });
});
