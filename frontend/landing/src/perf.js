// ───────── 계측 HUD (개발 전용) ─────────
// main.js 가 import.meta.env.DEV 일 때만 붙인다. 프로덕션 번들에는 들어가지 않는다.
//
// stats.js 를 쓰지 않는 이유 : 이 씬의 병목은 CPU 가 아니라 GPU 다 (프레임당 정점 19.5만,
// 그리드는 정점당 텍스처 페치 5회). CPU 시간만 보면 "60fps 나온다"고 거짓말을 한다.
// stats-gl 대신 직접 재는 이유 : 여기서 봐야 하는 것이 GPU 시간만이 아니다. 작업계획 6-4 의
// 예산 항목(드로우콜·게이트 간격·LoAF)을 한 패널에서 같이 봐야 회귀가 눈에 띈다. 의존성도 0.
//
// 게이트 간격이 여기 있는 이유 : 물 83.3ms / 배 125ms 는 의도된 질감이다. 두 값이 서로
// 같아지거나 60fps 로 붙으면 프레임 게이트가 깨진 것이고, 그건 화면만 봐서는 판정할 수 없다.
//
// ⚠ 창이 화면에 실제로 떠 있지 않으면 브라우저가 rAF 를 안 돌린다 (document.hidden 이 false
// 여도 그렇다). 그러면 GPU·rAF·게이트 값이 전부 거짓이 된다. 그래서 리포트에 visible/frames 를
// 같이 실어 보낸다 — 받는 쪽이 그 측정을 믿어도 되는지 판정할 수 있어야 한다.
//
// ⚠ 여기서 재는 값은 전부 '읽기'다. 씬 상태를 바꾸는 코드를 이 파일에 넣지 않는다.

const N = 600;          // 프레임 시간 링버퍼. 작업계획 6-4 의 "600프레임 p95" 규격
const GAP = 40;         // 게이트 간격 표본 수

// URL 에 ?perf 가 붙었을 때만 측정치를 개발 서버(/__perf)로 되돌린다.
// 창을 볼 수 없는 쪽에서 rAF p95 / GPU ms 를 회수하는 유일한 경로다. 평소엔 아무것도 안 보낸다
const REPORT = typeof location !== 'undefined' && /(^|[?&])perf($|[=&])/.test(location.search);

const median = (a) => {
  if (!a.length) return NaN;
  const s = [...a].sort((x, y) => x - y);
  return s[s.length >> 1];
};

export function createPerf(renderer, stage) {
  const gl = renderer.getContext();
  // 없는 브라우저가 많다 (Chrome 도 상황에 따라 null). 없으면 GPU 줄만 비운다
  const ext = gl.getExtension('EXT_disjoint_timer_query_webgl2');

  const box = document.createElement('div');
  box.style.cssText =
    // ⚠ 호스트 헤더(hostTop — 앱의 유리판 헤더 90px)가 무대 위를 가리므로 그만큼 내린다 (2026-09-16, D). 단독 실행이면 0 이라 예전 자리다
    'position:absolute;top:calc(var(--pb-host-top,0px) + 12px);left:12px;z-index:50;padding:8px 10px;' +
    'background:rgba(248,247,243,0.82);border:1px solid rgba(26,26,26,0.18);border-radius:4px;' +
    'font:11px/1.55 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;color:#1A1A1A;' +
    'white-space:pre;pointer-events:none;font-variant-numeric:tabular-nums;';
  stage.appendChild(box);

  const frames = new Float32Array(N);
  let fi = 0, fn = 0, prev = performance.now();
  const t0 = prev;
  let total = 0, hiddenFrames = 0;

  // GPU 타이머 : TIME_ELAPSED 는 동시에 하나만 열 수 있다. 결과는 몇 프레임 뒤에 나온다
  let active = null;
  const pending = [];
  let gpuMs = NaN, gpuMax = 0;

  // 게이트 간격. sim.stepped / boat.stepped 가 켜진 프레임 사이의 실제 시간
  const simGap = [], boatGap = [];
  let simLast = 0, boatLast = 0;

  // LoAF — 렌더 루프가 입력을 막은 시간. INP 는 드래그·휠을 집계에서 빼므로 조타 반응성은 이쪽으로 본다
  let loafMax = 0, loafAll = 0, loafAt = 0, loafSteady = 0, obs = null;
  const WARMUP = 5000;   // 시작 5초는 셰이더 컴파일·시뮬 워밍업 구간
  try {
    obs = new PerformanceObserver((list) => {
      for (const e of list.getEntries()) {
        const b = e.blockingDuration || 0;
        if (b > loafMax) loafMax = b;
        if (b > loafAll) { loafAll = b; loafAt = e.startTime; }
        // 워밍업의 한 번짜리 히치와 항해 중에 반복되는 막힘은 완전히 다른 문제다. 따로 센다
        if (e.startTime > WARMUP && b > loafSteady) loafSteady = b;
      }
    });
    obs.observe({ type: 'long-animation-frame', buffered: true });
  } catch (e) { obs = null; }   // Chrome/Edge 123+ 외에는 없다

  let paint = 0, sent = 0;

  const sorted = () => Array.prototype.slice.call(frames, 0, fn).sort((a, b) => a - b);
  const pctOf = (s, p) => (s.length ? s[Math.min(s.length - 1, Math.floor(s.length * p))] : NaN);
  const n1 = (v) => (Number.isFinite(v) ? v.toFixed(1) : '—');

  // 어느 GPU 에서 잰 값인지 남긴다 — 이 숫자는 기기가 바뀌면 의미가 달라진다
  let gpuName = 'unknown';
  try {
    const dbg = gl.getExtension('WEBGL_debug_renderer_info');
    if (dbg) gpuName = gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL);
  } catch (e) { /* 막혀 있으면 그냥 unknown */ }

  return {
    // ⚠ 읽기 전용 참조다. `campanel.js` 의 [화면만] 이 이걸 숨긴다 —
    //   이 파일의 규칙("씬 상태를 바꾸는 코드를 여기 넣지 않는다")은 그대로다.
    //   숨기는 주체는 밖이고, 여기서는 손잡이만 내준다
    el: box,

    // 렌더 직전. 시뮬 패스까지 포함해야 프레임의 진짜 GPU 시간이 된다
    begin() {
      if (ext && !active) {
        active = gl.createQuery();
        gl.beginQuery(ext.TIME_ELAPSED_EXT, active);
      }
    },

    end(sim, boat) {
      const now = performance.now();
      frames[fi] = now - prev;
      fi = (fi + 1) % N;
      fn = Math.min(fn + 1, N);
      total++;
      if (document.hidden) hiddenFrames++;
      prev = now;

      if (sim.stepped) {
        if (simLast) { simGap.push(now - simLast); if (simGap.length > GAP) simGap.shift(); }
        simLast = now;
      }
      if (boat.stepped) {
        if (boatLast) { boatGap.push(now - boatLast); if (boatGap.length > GAP) boatGap.shift(); }
        boatLast = now;
      }

      if (ext) {
        if (active) { gl.endQuery(ext.TIME_ELAPSED_EXT); pending.push(active); active = null; }
        // 컨텍스트가 흔들리면(disjoint) 대기 중인 값은 전부 신뢰할 수 없다 — 버린다
        if (gl.getParameter(ext.GPU_DISJOINT_EXT)) {
          pending.forEach(q => gl.deleteQuery(q));
          pending.length = 0;
        }
        while (pending.length && gl.getQueryParameter(pending[0], gl.QUERY_RESULT_AVAILABLE)) {
          const q = pending.shift();
          gpuMs = gl.getQueryParameter(q, gl.QUERY_RESULT) / 1e6;
          if (gpuMs > gpuMax) gpuMax = gpuMs;
          gl.deleteQuery(q);
        }
      }

      // 4Hz 로만 그린다 — 매 프레임 DOM 을 건드리면 측정 대상이 측정기를 방해한다
      if (now - paint < 250) return;
      paint = now;
      const r = renderer.info.render, m = renderer.info.memory;
      const s = sorted();
      const p50 = pctOf(s, 0.5), p95 = pctOf(s, 0.95);
      box.textContent =
        'GPU  ' + n1(gpuMs) + 'ms' + (ext ? '' : ' (미지원)') + '\n' +
        'rAF  p50 ' + n1(p50) + '  p95 ' + n1(p95) + 'ms\n' +
        'draw ' + r.calls + '  prog ' + renderer.info.programs.length + '  tex ' + m.textures + '\n' +
        'tri  ' + r.triangles + '  line ' + r.lines + '\n' +
        '물   ' + n1(median(simGap)) + 'ms   배 ' + n1(median(boatGap)) + 'ms\n' +
        'LoAF ' + (obs ? loafMax.toFixed(0) + 'ms' : '미지원');
      loafMax = 0;

      // 5초마다 한 번, 링버퍼가 찬 뒤에만 보낸다 (600프레임 = 10초)
      if (REPORT && now - sent > 5000) {
        sent = now;
        const secs = (now - t0) / 1000;
        fetch('/__perf', {
          method: 'POST',
          body: JSON.stringify({
            측정시각: new Date().toISOString(),
            gpu: gpuName,
            창: { dpr: renderer.getPixelRatio(), w: innerWidth, h: innerHeight,
                  숨은프레임: hiddenFrames, 포커스: document.hasFocus() },
            // 이 셋으로 측정을 믿어도 되는지 판정한다. fps 가 55~60 이 아니면 rAF 가 안 돈 것
            표본: { 총프레임: total, 경과초: +secs.toFixed(1), 평균fps: +(total / secs).toFixed(1),
                    링버퍼: fn + '/' + N },
            rAF: { p50: +p50.toFixed(2), p95: +p95.toFixed(2),
                   p99: +pctOf(s, 0.99).toFixed(2), max: +s[s.length - 1].toFixed(2) },
            GPU: ext ? { 최근ms: +gpuMs.toFixed(3), 최대ms: +gpuMax.toFixed(3) } : '미지원',
            LoAF: obs ? { 전체최대ms: +loafAll.toFixed(1), 그시점초: +(loafAt / 1000).toFixed(1),
                          워밍업이후최대ms: +loafSteady.toFixed(1) } : '미지원',
            게이트: { 물ms: +median(simGap).toFixed(1), 배ms: +median(boatGap).toFixed(1),
                      표본: simGap.length + '/' + boatGap.length },
            기준선: { draw: r.calls, prog: renderer.info.programs.length, tex: m.textures,
                      tri: r.triangles, line: r.lines }
          })
        }).catch(() => { /* 리포트 실패가 씬을 멈추지 않게 */ });
      }
    },

    dispose() {
      if (obs) obs.disconnect();
      if (ext) {
        if (active) { gl.endQuery(ext.TIME_ELAPSED_EXT); gl.deleteQuery(active); active = null; }
        pending.forEach(q => gl.deleteQuery(q));
        pending.length = 0;
      }
      box.remove();
    }
  };
}
