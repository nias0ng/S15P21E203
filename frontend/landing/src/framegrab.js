// ───────── 프레임 잡기 — 연속 프레임을 모아 한 장씩 넘겨 본다 (개발 전용) ─────────
// 2026-09-12 저녁, 사용자 : *"저가 화면 자체를 계속 관찰할수 있는 저 빈도수 잦은 프레임으로
//   스크린샷처럼 확인못하나?"*. 움찔거림은 **프레임 사이**에서 일어나므로 실시간으로는
//   눈이 못 따라가고, 녹화는 30fps 로 다시 샘플링되면서 증거가 뭉개진다 (실측 : 30.29fps 녹화가
//   30fps 게이트와 비팅을 일으켜 "가속" 이 평균의 10배까지 튀어 보였다).
//
// ⚠⚠ **렌더 직후 같은 틱에 잡아야 한다.** `preserveDrawingBuffer` 가 false 라 다음 틱에는
//   드로잉 버퍼가 비어 있다 — main.js 의 tick 맨 끝(bloom.render 뒤)에서 `tick()` 을 부른다.
// ⚠ 저장은 `drawImage` 로 **작은 캔버스에 복사**한다. `toDataURL` 은 프레임마다 PNG 인코딩이
//   들어가서 그 자체가 프레임을 늘어뜨린다 — 재려는 현상을 재는 행위가 바꿔 버린다.
// ⚠ 메모리 : 960×540 RGBA ≈ 2MB. 기본 48장이면 100MB 안쪽이다. 그 이상은 브라우저가 흔들린다.
//
// 쓰는 법 (콘솔) :  PB.grab.start()            48장을 잡고 바로 뷰어를 연다
//                  PB.grab.start(90, 0.4)     90장을 0.4 배로
//   뷰어 : ← → 한 장씩 · Shift+← → 열 장씩 · Space 재생/정지 · D 차이 보기 · ESC 닫기

// ⚠⚠ **잡은 장수 ≠ 초다.** 화면 렌더는 **제한이 없어서** 160fps 까지 돈다 — `simFps 30` 은
//   *물 갱신*만 30 이다. 그래서 90장이 3초가 아니라 **0.56초**였다 (실측 프레임 간격 중앙 6.2ms).
//   사용자 2026-09-12 저녁 : *"90프레임이면 3초 정도 지나는것을 측정해야하는데 … 1초를 쪼개둔듯"*.
//   ⭐ 그 관찰이 곧 원인이다 — 화면 160fps 와 물 30fps 의 격차가 움찔거림이다.
//   그래서 뷰어와 report 가 **총 시간과 실제 fps 를 같이** 보여 준다.
// ⚠ 기본 120장 · 0.35배 (1920 → 672×368 ≈ 1MB/장, 120MB 안쪽).
const DEF_N = 120, DEF_SCALE = 0.35;

export function createFrameGrab(renderer, stage, readState) {
  let want = 0, scale = DEF_SCALE, cap = DEF_N, ring = false;
  const shots = [];            // { cv, t, meta }
  const pool = [];             // ⚠ 캔버스를 재활용한다 — 링 모드에서 매 프레임 새로 만들면 GC 가 프레임을 끊는다
  let ui = null, idx = 0, playing = false, diffOn = false, playT = 0;

  // ── 캡처 (렌더 직후 tick 에서 불린다)
  function tick() {
    if (!ring && want <= 0) return;
    const src = renderer.domElement;
    const w = Math.max(2, Math.round(src.width * scale));
    const h = Math.max(2, Math.round(src.height * scale));
    let slot;
    if (ring && shots.length >= cap) {
      slot = shots.shift();                 // 가장 오래된 것을 재활용 (할당 0)
      if (slot.cv.width !== w || slot.cv.height !== h) { slot.cv.width = w; slot.cv.height = h; }
    } else {
      const cv = pool.pop() || document.createElement('canvas');
      if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; }
      slot = { cv, t: 0, meta: null };
    }
    slot.cv.getContext('2d', { willReadFrequently: true }).drawImage(src, 0, 0, w, h);
    slot.t = performance.now();
    slot.meta = readState ? readState() : null;
    shots.push(slot);
    if (!ring && --want === 0) open();
  }

  function start(n = DEF_N, sc = DEF_SCALE) {
    while (shots.length) pool.push(shots.pop().cv);
    idx = 0; diffOn = false; playing = false; ring = false;
    scale = Math.min(1, Math.max(0.15, sc));
    want = cap = Math.max(2, Math.round(n));
    close();
    return '잡는 중 — ' + want + '장';
  }

  // ⭐⭐ **계속 잡다가 멈추면 직전 N 장을 본다** (2026-09-12 저녁). 사용자 :
  //   *"shift 를 누르고 배가 빠르게 움직일때 주로 관찰되는거라"* — 부스트를 누르고 있는
  //   동안에는 버튼을 누를 손이 없다. 그래서 **먼저 걸어 두고, 본 뒤에 멈춘다.**
  //   ⚠ 캔버스를 돌려 쓰므로 매 프레임 할당이 없다 — 재려는 프레임을 GC 가 끊으면 안 된다.
  function arm(n = DEF_N, sc = DEF_SCALE) {
    while (shots.length) pool.push(shots.pop().cv);
    idx = 0; diffOn = false; playing = false;
    scale = Math.min(1, Math.max(0.15, sc));
    cap = Math.max(2, Math.round(n));
    want = 0; ring = true;
    close();
    return '계속 잡는 중 — 멈추면 직전 ' + cap + '장을 본다 (PB.grab.stop())';
  }

  function stop() {
    ring = false; want = 0;
    if (shots.length >= 2) open();
    return shots.length + '장';
  }

  // ── 뷰어
  function open() {
    close();
    ui = document.createElement('div');
    ui.style.cssText = 'position:absolute;inset:0;z-index:9999;background:#101014;' +
      'display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;' +
      'font:12px/1.5 ui-monospace,Menlo,Consolas,monospace;color:#e8e6e0';
    const cv = document.createElement('canvas');
    cv.style.cssText = 'max-width:94%;max-height:82%;background:#000;image-rendering:pixelated';
    const bar = document.createElement('div');
    bar.style.cssText = 'display:flex;gap:10px;align-items:center;flex-wrap:wrap;justify-content:center';
    const info = document.createElement('div');
    info.style.cssText = 'min-width:520px;text-align:center;white-space:pre';
    const mk = (label, fn) => {
      const b = document.createElement('button');
      b.textContent = label;
      b.style.cssText = 'font:inherit;cursor:pointer;background:#26262e;color:inherit;' +
        'border:1px solid #45454f;border-radius:3px;padding:2px 9px';
      b.addEventListener('click', e => { e.stopPropagation(); fn(); });
      return b;
    };
    const bPrev = mk('◀ 이전', () => { playing = false; step(-1); });
    const bNext = mk('다음 ▶', () => { playing = false; step(1); });
    const bPlay = mk('재생', () => { playing = !playing; playT = performance.now(); bPlay.textContent = playing ? '정지' : '재생'; });
    const bDiff = mk('차이 보기 (D)', () => { diffOn = !diffOn; draw(); });
    const bClose = mk('닫기 (ESC)', close);
    bar.append(bPrev, bNext, bPlay, bDiff, bClose);
    ui.append(cv, bar, info);
    stage.appendChild(ui);

    const ctx = cv.getContext('2d');
    function draw() {
      const s = shots[idx];
      if (!s) return;
      cv.width = s.cv.width; cv.height = s.cv.height;
      if (!diffOn || idx === 0) {
        ctx.drawImage(s.cv, 0, 0);
      } else {
        // ⚠ 차이는 **증폭해서** 칠한다 — 움찔은 몇 레벨짜리라 그냥 빼면 검은 화면이 된다
        const a = shots[idx - 1].cv.getContext('2d').getImageData(0, 0, cv.width, cv.height);
        const b = s.cv.getContext('2d').getImageData(0, 0, cv.width, cv.height);
        const out = ctx.createImageData(cv.width, cv.height);
        for (let i = 0; i < out.data.length; i += 4) {
          const d = Math.abs(a.data[i] - b.data[i]) + Math.abs(a.data[i+1] - b.data[i+1]) + Math.abs(a.data[i+2] - b.data[i+2]);
          const v = Math.min(255, d * 6);
          out.data[i] = v; out.data[i+1] = (v * 0.55) | 0; out.data[i+2] = 0; out.data[i+3] = 255;
        }
        ctx.putImageData(out, 0, 0);
      }
      const m = s.meta || {};
      const dt = idx > 0 ? (s.t - shots[idx-1].t) : 0;
      const span = shots.length > 1 ? (shots[shots.length-1].t - shots[0].t) : 0;
      const fps = span > 0 ? (shots.length - 1) / (span / 1000) : 0;
      const at = idx > 0 ? (s.t - shots[0].t) : 0;
      info.textContent =
        `프레임 ${String(idx + 1).padStart(3)} / ${shots.length}   ` +
        `${(at/1000).toFixed(2)}s / 총 ${(span/1000).toFixed(2)}s   화면 ${fps.toFixed(0)}fps   Δ${dt.toFixed(1)}ms` +
        (m.scrollZ !== undefined ? `   배 z ${m.scrollZ.toFixed(3)}  속도 ${(m.speed ?? 0).toFixed(3)}` : '') +
        (m.stepped !== undefined ? `   물갱신 ${m.stepped ? '●' : '·'}` : '') +
        (m.acc ? `   이류잔여 x ${m.acc.x.toFixed(3)}  z ${m.acc.z.toFixed(3)}` : '') +
        `\n← → 한 장씩 · Shift 로 열 장씩 · Space 재생 · D 차이 보기 (지금 ${diffOn ? '켬' : '끔'}) · ESC 닫기`;
    }
    function step(d) { idx = Math.min(shots.length - 1, Math.max(0, idx + d)); draw(); }
    ui.__draw = draw; ui.__step = step;

    const onKey = e => {
      if (e.key === 'Escape') { close(); return; }
      if (e.key === 'ArrowLeft') { playing = false; step(e.shiftKey ? -10 : -1); e.preventDefault(); }
      else if (e.key === 'ArrowRight') { playing = false; step(e.shiftKey ? 10 : 1); e.preventDefault(); }
      else if (e.key === ' ') { playing = !playing; playT = performance.now(); bPlay.textContent = playing ? '정지' : '재생'; e.preventDefault(); }
      else if (e.key === 'd' || e.key === 'D') { diffOn = !diffOn; draw(); }
      e.stopPropagation();
    };
    ui.__onKey = onKey;
    window.addEventListener('keydown', onKey, true);
    draw();

    // 느린 재생 (초당 6장) — 눈으로 따라갈 수 있는 속도다
    (function loop() {
      if (!ui) return;
      if (playing && performance.now() - playT > 166) {
        playT = performance.now();
        idx = (idx + 1) % shots.length;
        draw();
      }
      ui.__raf = requestAnimationFrame(loop);
    })();
  }

  function close() {
    if (!ui) return;
    window.removeEventListener('keydown', ui.__onKey, true);
    if (ui.__raf) cancelAnimationFrame(ui.__raf);
    ui.remove(); ui = null; playing = false;
  }

  // ⭐ 잡은 것을 **숫자로도** 본다 — 프레임별 변화량과 이류 잔여를 한 줄씩.
  //   눈으로 못 가르는 것을 여기서 가른다 (콘솔 : PB.grab.report())
  function report() {
    const out = [];
    for (let i = 1; i < shots.length; i++) {
      const A = shots[i-1], B = shots[i];
      const w = B.cv.width, h = B.cv.height;
      const a = A.cv.getContext('2d').getImageData(0, 0, w, h).data;
      const b = B.cv.getContext('2d').getImageData(0, 0, w, h).data;
      let sum = 0, hot = 0;
      for (let k = 0; k < a.length; k += 16) {          // 4픽셀 건너 표본
        const d = Math.abs(a[k] - b[k]);
        sum += d; if (d > 10) hot++;
      }
      const n = a.length / 16;
      out.push({
        f: i, dtMs: +(B.t - A.t).toFixed(1),
        평균변화: +(sum / n).toFixed(3), 큰변화비율: +(hot / n * 100).toFixed(2),
        물갱신: B.meta ? B.meta.stepped : null,
        이류잔여x: B.meta && B.meta.acc ? +B.meta.acc.x.toFixed(3) : null,
        이류잔여z: B.meta && B.meta.acc ? +B.meta.acc.z.toFixed(3) : null,
        배z: B.meta ? +B.meta.scrollZ.toFixed(3) : null
      });
    }
    return out;
  }

  // ⭐ G 키 — 걸고(arm) 멈춘다(stop). 부스트를 누르고 있는 손으로 버튼을 못 누른다
  //   ⚠ 뷰어가 열려 있을 때는 무시한다 (거기선 ← → D Space 가 이미 있다)
  const onG = e => {
    if ((e.key !== 'g' && e.key !== 'G') || e.ctrlKey || e.metaKey || e.altKey) return;
    if (ui) return;
    if (ring) stop(); else arm();
  };
  window.addEventListener('keydown', onG);

  return {
    tick, start, arm, stop, open, close, report,
    // ⭐ **장수만 보면 초를 오해한다** — 총 시간과 두 fps 를 같이 낸다.
    //   화면 fps 와 물 갱신 fps 의 격차가 클수록 뚝뚝 끊긴다 (그것이 움찔거림이다)
    summary() {
      if (shots.length < 2) return null;
      const span = (shots[shots.length-1].t - shots[0].t) / 1000;
      const stepN = shots.filter(x => x.meta && x.meta.stepped).length;
      return { 장수: shots.length, 총초: +span.toFixed(3),
               화면fps: +((shots.length-1)/span).toFixed(1),
               물갱신fps: +(stepN/span).toFixed(1),
               한번갱신마다_화면프레임: +((shots.length-1)/Math.max(1,stepN)).toFixed(2) };
    },
    dispose() { window.removeEventListener('keydown', onG); close(); },
    get armed() { return ring; },
    get shots() { return shots; },
    get count() { return shots.length; },
    get busy() { return want > 0; }
  };
}
