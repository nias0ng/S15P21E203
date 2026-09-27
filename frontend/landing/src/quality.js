import { PARAMS as P } from './params.js';

// ───────── 품질 단계 (2026-09-25, S15P21E203-435) ─────────
// 사용자 : *"이 프로젝트 서비스를 경험하는 사람들은 대부분 노트북 … 옵티머스로 인해 강제적으로 CPU 내장 그래픽 카드만 사용해서
//   프레임이 40~50 밖에 안나오며 … 내장그래픽 점유율이 80~90 %"* · *"그러한 조건의 사용자라면 … 선택권을 줌과 동시에
//   낮은 레벨의 설정으로 서비스를 시작"*. 설계 원본은 `docs/고도화-0917/02-노트북-크롬-GPU.md` §4-1 이다 (측정표는 거기 §5).
//
// 단계는 셋이다 — high(지금의 기준 그림) · mid · low. 모드는 넷이다 — auto + 셋 중 하나로 **고정**.
//   auto : GPU 이름으로 시작 단계를 고르고(내장 · 소프트웨어 → low), 달리는 동안 프레임 시간으로 한 단계씩만 움직인다.
//   고정 : 그 단계에서 안 움직인다 (앱의 그래픽 설정 · 발표용 `?quality=high`).
//
// ⚠⚠ 사이트는 GPU 를 못 바꾼다 — `powerPreference: 'high-performance'` 를 줘도 Windows 크롬은 내장 GPU 그대로다
//   (2026-09-25 실측 : RTX 4050 + Arc 옵티머스 노트북에서 셋 다 `Intel(R) Arc(TM) Graphics`). 할 수 있는 것은 가벼워지기와 알리기뿐이다.
//
// ⚠ 단계가 바꾸는 손잡이는 아래 TIERS 한 표다. **새 층을 만들면 제 문턱을 따로 두지 말고 이 표에 한 줄을 더한다** (CLAUDE.md 불변식 34).
//   params 값은 이 파일이 **만들 때의 값(BASE)에 배율을 곱해** 쓴다 — 콘솔에서 바꾼 값은 다음 단계 전환에서 BASE 로 돌아간다.

const ORDER = ['low', 'mid', 'high'];

// 픽셀비 = min(devicePixelRatio × prScale, prMax) · 아래로 0.6.
//   ⚠ 2026-09-25 실측 (Intel Arc 내장 · 1024×678 CSS · 배율 2 · 한 장 처리량 ms, 새 파이프라인) :
//     MSAA 4 · 19.1 · MSAA 2 · 16.1 · MSAA 0 · 10.6 (픽셀비 2) — 해상도에 비례하지 않는 바닥이 ~7ms 있다 (수면 메시 정점 ~2.9ms 가 가장 크다)
//     수면 메시 512 → 384 → 256 : 픽셀비 2 · MSAA 0 에서 12.3 → 10.1 → 8.3
//   ⭐ 2026-09-27 부터 mesh 는 **배 곁(config sim.meshNear 28m 안)의 간격**이다 — 그 밖은 성기게 넓힌다 (water.js waterGeometry).
//     정점 : 512 26.3만 → 12.5만 · 384 14.8만 → 7.7만 · 256 6.6만 → 3.9만. 위 ms 는 균일 격자 때의 실측이다 (보이는 창에서 다시 잴 것)
// ⚠ sunShadow (2026-09-27) — 물이 해 쪽 주광의 그림자 맵을 읽는 '배 그림자 ②' (water.js). 화면의 14~36% 에서 4~16탭을 짚는다.
//   유니폼으로만 끈다(세기 0 → 블록이 통째로 안 돈다) — define 이 아니라 전환에 셰이더를 다시 안 만든다. low 에서는 선체 발자국(①)만 남는다
export const TIERS = {
  high: { label: '높음', prMax: 2,   prScale: 1,    msaa: 4, mesh: 512,
          bloom: 1, reflect: 1, sub: 1, glint: 1,   glitOct2: 1, detailK: 1,   sunShadow: 1 },
  mid:  { label: '보통', prMax: 1.5, prScale: 1,    msaa: 2, mesh: 384,
          bloom: 1, reflect: 1, sub: 1, glint: 1,   glitOct2: 1, detailK: 1,   sunShadow: 1 },
  low:  { label: '낮음', prMax: 1,   prScale: 0.75, msaa: 0, mesh: 256,
          bloom: 0, reflect: 0, sub: 0, glint: 0.6, glitOct2: 0, detailK: 0.6, sunShadow: 0 }
};

// 단계를 한 칸 올렸을 때 GPU 시간이 몇 배가 되는가 (위 실측의 보수적인 쪽). 올림은 '지금 GPU 시간 × 이 값' 이 예산 안일 때만 한다
const UP_COST = { low: 2.6, mid: 2.0 };
const BUDGET_MS = 1000 / 60;

const MODES = ['auto', 'high', 'mid', 'low'];
const STORE_KEY = 'pb-quality';

// GPU 이름 → 부류. 렌더러 문자열은 ANGLE 이 감싼다 — 'ANGLE (Intel, Intel(R) Arc(TM) Graphics (0x00007D55) Direct3D11 …)'
//   ⚠ Arc 는 내장(Core Ultra 의 'Arc(TM) Graphics')과 외장('Arc(TM) A770')이 이름으로만 갈린다
//   ⚠ AMD 는 'Radeon RX · Pro' 만 외장이다 — 'Radeon(TM) Graphics' · 'Radeon 780M' 은 라이젠 내장이다
export function gpuClass(name) {
  const s = String(name || '').toLowerCase();
  if (!s) return 'unknown';
  if (/swiftshader|llvmpipe|softpipe|basic render|software/.test(s)) return 'software';
  if (/nvidia|geforce|quadro|rtx|gtx|tesla/.test(s)) return 'discrete';
  if (/radeon\s*(rx|pro)|firepro/.test(s)) return 'discrete';
  if (/arc\(tm\)\s*a\d|arc\s+a\d/.test(s)) return 'discrete';
  if (/apple/.test(s)) return 'apple';
  if (/intel|iris|uhd|hd graphics|radeon|vega|adreno|mali|powervr|videocore/.test(s)) return 'integrated';
  return 'unknown';
}

// auto 의 첫 단계. 내장 · 소프트웨어는 낮음에서 시작한다 (사용자 결정) — 여유가 보이면 GPU 타이머가 한 칸씩 올린다
const START = { discrete: 'high', apple: 'mid', unknown: 'mid', integrated: 'low', software: 'low' };

function readGpu(gl) {
  let name = '';
  try {
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    name = String(ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER)) || '';
  } catch (e) { name = ''; }
  return { name, cls: gpuClass(name) };
}

function urlMode() {
  try {
    const q = new URLSearchParams(location.search).get('quality');
    return MODES.includes(q) ? q : null;
  } catch (e) { return null; }
}

// ⚠ 기억은 **이 GPU · 이 화면**마다 따로다 — 외부 모니터를 꽂으면 픽셀 수가 달라 같은 GPU 라도 맞는 단계가 다르다
function signature(gpu) {
  const s = window.screen || {};
  return [gpu.cls, gpu.name, (s.width || 0) + 'x' + (s.height || 0), window.devicePixelRatio || 1].join('|');
}
function loadMemory() {
  try { const v = JSON.parse(localStorage.getItem(STORE_KEY) || 'null'); return v && v.v === 1 && v.auto ? v : { v: 1, auto: {} }; }
  catch (e) { return { v: 1, auto: {} }; }
}
function saveMemory(mem) {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(mem)); } catch (e) { /* 막힌 저장소 — 다음 방문에 다시 걷는다 */ }
}

const pct = (a, q) => a[Math.min(a.length - 1, Math.max(0, Math.floor(q * a.length)))];

// GPU 시간 — EXT_disjoint_timer_query_webgl2. 없는 브라우저(파이어폭스 · 사파리)에서는 올림을 안 한다 (내림만 한다)
//   ⚠ 숨겨진 창 · 패널에서는 이 값을 믿지 않는다 (CLAUDE.md 'GPU 비용을 잴 때'). 여기서는 사람이 보고 있는 탭에서만 돈다
//   ⚠ TIME_ELAPSED 쿼리는 **한 번에 하나만** 열린다 — 엔진 작업 브랜치의 계측 HUD(perf.js)도 이 자리를 쓴다.
//     남의 쿼리가 열려 있으면 이번 장은 건너뛰고, 닫을 때도 **내 것일 때만** 닫는다 (남의 측정을 끊지 않는다)
function createGpuTimer(gl) {
  let ext = null;
  try { ext = gl.getExtension('EXT_disjoint_timer_query_webgl2'); } catch (e) { ext = null; }
  if (!ext) return null;
  const pool = [], pending = [], samples = [];
  let active = null;
  const current = () => gl.getQuery(ext.TIME_ELAPSED_EXT, gl.CURRENT_QUERY);
  return {
    begin() {
      if (active || current()) return;
      active = pool.pop() || gl.createQuery();
      gl.beginQuery(ext.TIME_ELAPSED_EXT, active);
    },
    end() {
      if (!active) return;
      if (current() !== active) { pool.push(active); active = null; return; }
      gl.endQuery(ext.TIME_ELAPSED_EXT);
      pending.push(active);
      active = null;
      while (pending.length) {
        const q = pending[0];
        if (!gl.getQueryParameter(q, gl.QUERY_RESULT_AVAILABLE)) break;
        const bad = gl.getParameter(ext.GPU_DISJOINT_EXT);
        const ns = gl.getQueryParameter(q, gl.QUERY_RESULT);
        pending.shift();
        pool.push(q);
        if (!bad) samples.push(ns / 1e6);
      }
      if (pending.length > 8) { pool.push(...pending.splice(0, pending.length - 8)); }
    },
    take() { const s = samples.splice(0); s.sort((a, b) => a - b); return s; },
    dispose() {
      if (active && current() === active) gl.endQuery(ext.TIME_ELAPSED_EXT);
      [...pool, ...pending, ...(active ? [active] : [])].forEach(q => gl.deleteQuery(q));
      active = null;
      pool.length = 0; pending.length = 0;
    }
  };
}

/**
 * @param gl   렌더러의 WebGL 컨텍스트 (GPU 이름 · 타이머)
 * @param busy 측정을 쉬어야 하는가 — 앱 모달 · 잠수 · 선실 전환 동안 (main.js 가 넘긴다)
 */
export function createQuality({ gl, busy }) {
  const gpu = readGpu(gl);
  const sig = signature(gpu);
  const mem = loadMemory();
  const BASE = {
    bloomAmount: P.bloomAmount, boatReflect: P.boatReflect, subAmount: P.subAmount,
    glintHot: P.glintHot === undefined ? 0 : P.glintHot, glitterOct2: P.glitterOct2,
    waterSunShadow: P.waterSunShadow === undefined ? 0 : P.waterSunShadow
  };
  const timer = createGpuTimer(gl);
  const listeners = new Set();

  let mode = urlMode() || 'auto';
  const startTier = () => (mem.auto[sig] && TIERS[mem.auto[sig].tier]) ? mem.auto[sig].tier : START[gpu.cls];
  let tier = mode === 'auto' ? startTier() : mode;
  let reason = 'start';

  // ── 달리는 동안의 판정. 창 하나 = 2초 · 최소 60장
  const WIN_MS = 2000;
  const iv = [];
  let last = 0, winStart = 0, holdUntil = performance.now() + 6000;
  let slowWins = 0, fastWins = 0, floorWins = 0;
  let upAt = -1e9, upLocked = false, stableSince = performance.now(), savedTier = null, slowTold = false;

  const hold = (ms) => { holdUntil = Math.max(holdUntil, performance.now() + ms); iv.length = 0; winStart = 0; if (timer) timer.take(); };

  function info() {
    return { mode, tier, auto: mode === 'auto', reason, gpu: { name: gpu.name, cls: gpu.cls }, label: TIERS[tier].label, timer: !!timer };
  }
  function emit() { const i = info(); listeners.forEach(fn => { try { fn(i); } catch (e) { console.warn('[quality]', e); } }); }

  function setTier(next, why) {
    if (!TIERS[next] || next === tier) return false;
    tier = next; reason = why;
    slowWins = 0; fastWins = 0; floorWins = 0;
    stableSince = performance.now();
    hold(3000);
    if (why === 'up') upAt = performance.now();
    if (mode === 'auto' && why === 'down') remember();
    emit();
    return true;
  }
  function remember() {
    if (mode !== 'auto' || savedTier === tier) return;
    savedTier = tier;
    mem.auto[sig] = { tier, t: Date.now() };
    saveMemory(mem);
  }

  function evaluate(now) {
    if (iv.length < 60) return;
    const a = iv.slice().sort((x, y) => x - y);
    iv.length = 0;
    const p50 = pct(a, 0.5), p90 = pct(a, 0.9);
    const gpuMs = timer ? timer.take() : [];
    const g50 = gpuMs.length >= 20 ? pct(gpuMs, 0.5) : null;
    const downMs = P.qualityDownMs === undefined ? 26 : P.qualityDownMs;
    // ⚠⚠ **33ms 에 고르게 묶인 간격만으로는 '에너지 절약 30Hz' 와 'GPU 가 버거운 60Hz 화면' 을 못 가른다** —
    //   수직동기 때문에 한 장이 17~33ms 걸리면 간격이 두 칸(33.3ms)으로 **똑같이 고르게** 묶인다 (2026-09-25 모의 실험 :
    //   설계 §4-1 의 모양 규칙만 두면 GPU 28ms · 33fps 인 외장 GPU 가 한 번도 안 내려왔다).
    //   그래서 GPU 타이머가 있으면 **GPU 가 간격의 절반 넘게 일하고 있을 때만** 느리다고 본다 — 상한 · CPU 병목에서는 단계를 내려도 안 빨라진다.
    //   타이머가 없는 브라우저에서만 모양으로 가른다 (에너지 절약 · 30Hz 모양이면 50ms 를 넘을 때만 내린다)
    const capped30 = p50 > 30 && p50 < 37 && p90 - p50 < 6;
    const slow = g50 !== null
      ? p90 > downMs && g50 > 0.55 * p50
      : (capped30 ? p90 > 50 : p90 > downMs);
    if (slow) {
      fastWins = 0;
      const i = ORDER.indexOf(tier);
      if (i > 0) {
        if (++slowWins >= 2) {
          // 올린 지 20초 안에 다시 내려오면 이 세션에서는 더 안 올린다 (오르내림 진동을 막는다)
          if (now - upAt < 20000) upLocked = true;
          setTier(ORDER[i - 1], 'down');
        }
      } else if (++floorWins >= 3 && !slowTold) {
        // 가장 낮은 단계에서도 느리다 — 앱이 전원 · 그래픽 설정 안내를 띄운다 (세션에 한 번)
        slowTold = true; reason = 'slow'; emit();
      }
      return;
    }
    slowWins = 0; floorWins = 0;
    if (now - stableSince > 20000) remember();
    const next = ORDER[ORDER.indexOf(tier) + 1];
    const k = UP_COST[tier];
    const budget = BUDGET_MS * (P.qualityUpBudget === undefined ? 0.75 : P.qualityUpBudget);
    if (!next || upLocked || g50 === null || !k || p90 > 20 || g50 * k > budget) { fastWins = 0; return; }
    if (++fastWins >= 3) setTier(next, 'up');
  }

  return {
    get tier() { return tier; },
    get mode() { return mode; },
    gpu,
    bundle: () => TIERS[tier],
    info,
    onChange(fn) { listeners.add(fn); return () => listeners.delete(fn); },

    // 지금 단계의 픽셀비
    pixelRatio() {
      const T = TIERS[tier];
      return Math.max(0.6, Math.min((window.devicePixelRatio || 1) * T.prScale, T.prMax));
    },

    // 단계의 params 묶음을 쓴다 (나머지 손잡이 — 픽셀비 · MSAA · 메시 — 는 main.js 의 applyQuality 가 건다)
    writeParams() {
      const T = TIERS[tier];
      P.bloomAmount = BASE.bloomAmount * T.bloom;
      P.boatReflect = BASE.boatReflect * T.reflect;
      P.subAmount = BASE.subAmount * T.sub;
      P.glintHot = BASE.glintHot * T.glint;
      P.glitterOct2 = BASE.glitterOct2 * T.glitOct2;
      P.detailK = T.detailK;
      P.waterSunShadow = BASE.waterSunShadow * T.sunShadow;
    },

    // 앱의 그래픽 설정 · 콘솔 (PB.quality.set)
    setMode(m) {
      if (!MODES.includes(m)) return false;
      const prev = mode;
      mode = m;
      upLocked = false; slowTold = false;
      const changed = setTier(m === 'auto' ? (prev === 'auto' ? tier : startTier()) : m, 'user');
      if (!changed) { reason = 'user'; emit(); }
      return true;
    },

    hold,

    frameBegin() { if (timer && mode === 'auto') timer.begin(); },
    frameEnd(now) {
      if (timer && mode === 'auto') timer.end();
      if (mode !== 'auto') return;
      const dt = last ? now - last : 0;
      last = now;
      // 긴 멈춤(탭 복귀 · 가려진 창 · 디버거)은 표본이 아니다 — 창을 비우고 다시 센다
      if (dt <= 0 || dt > 250) { if (dt > 250) hold(1000); return; }
      if (now < holdUntil || (busy && busy())) { iv.length = 0; winStart = 0; if (timer) timer.take(); return; }
      if (!winStart) winStart = now;
      iv.push(dt);
      if (now - winStart >= WIN_MS) { winStart = now; evaluate(now); }
    },

    dispose() { if (timer) timer.dispose(); listeners.clear(); }
  };
}
