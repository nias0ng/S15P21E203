import { PARAMS as P } from './params.js';

// ───────── 미니맵 (2026-09-11, v0.32.0) ─────────
// 향수 지도(scentmap.js)를 위에서 본 **추상 지도**다. 사용자 : *"미니맵을 만드는데 사실상 미니맵과 화면의
//   연출은 조금 달라야할 것 같음 · 웹 항해 게임이라 생각하고"*.
//   그래서 3D 바다를 줄여 그리지 않는다 — 점 · 해역 이름 · 배 화살표 · 지금 화면이 담는 부채꼴만 그린다.
//
// ⚠ 좌표는 scentmap 의 월드 좌표 그대로다 (변환식을 여기 또 적지 않는다 — 불변식 21).
//   북(−Z, map_y 큰 쪽)이 **위**다. 배의 월드 위치는 (scroll.x, −scroll.z) 다 (불변식 0-2).
// ⚠ 누르면 두 갈래 (사용자 : *"해당 영역 또는 바다의 빈곳을 클릭했을때"*) :
//     해역 이름 근처 → 그 해역의 대표 향수 자리 (메도이드)
//     그 밖         → **누른 그 자리** (해역 이름은 가장 가까운 향수의 향조 — scentmap.regionAt)
//   가는 일은 travel.js 가 한다 (lead → 흰 안개 → 목표 앞).
// ⚠ 캔버스는 **값이 바뀔 때만** 다시 그린다 (배 위치·방향·목표·호버를 키로). 점 200개와 이름은
//   정적 층으로 한 번 구워 두고 매번 그 위에 배만 얹는다.
//
// ⭐⭐ 2026-09-11 오후 — 두 층이 더해졌다.
//   ① **안개** (`minimapFog`) — 게임처럼 **지나온 바다만 밝다.** 사용자 : *"미니맵이 암흑 시야 및 탐색한 부분을 확인할 수
//      있게 지나온 영역만 밝게 … 어떤 영역, 어떤 향수 위치는 전부 보이게"*.
//      격자(4 월드 칸)에 '가 봤다' 를 적고, 칸 하나를 한 픽셀로 둔 작은 마스크를 **부드럽게 키워** 안개에 구멍을 낸다
//      (쌍선형 확대가 곧 부드러운 가장자리다 — 칸마다 원을 그리지 않는다). 쌓는 순서가 핵심이다 :
//        안개(어두움, 구멍) → **점 · 해역 이름**(정적 층) → 부채꼴 · 목표 · 배
//      그래서 안개가 점과 이름을 **덮지 않는다.** 기록은 localStorage (지도 크기별 키) — 지우기 `PB.minimap.resetFog()`.
//      ⚠ 순간이동(흰 안개)으로 건너뛴 바다는 밝아지지 않는다 — '지나온' 곳이 아니다. 도착한 자리만 밝아진다
//   ② **범위 없음** (`mapBound`) — 지도 사각형 + mapMargin 밖을 **빗금 띠**로 그린다. 거기를 누르면 가지 않고 경고만 띄운다
//      (onBlocked → main.js → ui.warn). 배가 그 선에 닿을 때도 같은 경고다 (main.js).
//      ⭐ 2026-09-13 (v0.50.0) : 빗금이 아니라 **`--pb-void` 한 색**이고, 경계는 **원들의 합집합을 정확한 호로** 그린다
//        (`scentmap.navOutline`) — 해도와 같은 색 · 같은 모양이다 (사용자 : *"연관성을 만들어야하니 작은 미니맵에도 같은 색상으로"*)

const FOG_CELL = 4;            // 안개 격자 한 칸 (월드). 배 한 척(5)보다 조금 작다
const FOG_KEY = 'pb.minimap.fog.v1:';
// 갈 수 없는 띠를 미니맵에 얼마나 보여 줄지 (월드).
// ⚠ 2026-09-12 저녁 : 14 → **6**. `navRect` 가 이미 `navReach`(45)만큼 넓어졌으므로 (v0.45.0)
//   띠까지 넓게 두면 판의 대부분이 막힌 바다(당시 빗금 · 지금 `--pb-void`)가 되어 지도가 답답하다
// ⭐ 해도(chart.js)도 이 값을 쓴다 — 두 지도가 **같은 사각형**을 담아야 같은 바다로 읽힌다 (불변식 2)
export const BAND = 6;

export function createMinimap({ onPick, onBlocked } = {}) {
  const box = document.getElementById('minimap');
  const cv = document.getElementById('minimap-canvas');
  const hint = document.getElementById('minimap-hint');
  if (!box || !cv) return { update() {}, dispose() {}, resetFog() {}, fogReport() { return '미니맵 없음'; } };
  const ctx = cv.getContext('2d');
  const stat = document.createElement('canvas');   // 정적 층 캐시 (점 · 경계 · 해역 이름)
  const sctx = stat.getContext('2d');
  const fogCv = document.createElement('canvas');  // 안개 층 (구멍 뚫린 어둠) — 새 칸이 밝혀질 때만 다시 그린다
  const fctx = fogCv.getContext('2d');
  const mask = document.createElement('canvas');   // 칸 = 픽셀. 가 본 칸만 불투명
  const mctx = mask.getContext('2d');

  let map = null, mapKey = '', W = 0, H = 0, dpr = 1;
  let last = '', hover = null, visible = false;
  let boat = { x: 0, z: 0, head: 0 }, target = null, foot = null;
  let PAD = 8;   // 캔버스 안쪽 여백 (CSS px)
  const LABEL_R = 16;   // 해역 이름을 '눌렀다' 로 볼 반경 (CSS px)
  // 미니맵이 담는 월드 사각형. 범위가 켜져 있으면 **갈 수 있는 바다 + 바깥 띠**, 꺼져 있으면 예전처럼 지도 사각형
  let view = { x0: 0, x1: 1, z0: 0, z1: 1 };
  const boundOn = () => (P.mapBound === undefined ? 1 : P.mapBound) >= 0.5;
  const margin = () => Math.max(0, P.mapMargin === undefined ? 20 : P.mapMargin);

  // 월드 ↔ 캔버스 (CSS px). ⚠ 북(−Z)이 위 — z 가 작을수록 y 가 작다
  const toC = (x, z) => [PAD + (x - view.x0) / (view.x1 - view.x0) * (W - 2 * PAD), PAD + (z - view.z0) / (view.z1 - view.z0) * (H - 2 * PAD)];
  const toW = (cx, cy) => [view.x0 + (cx - PAD) / (W - 2 * PAD) * (view.x1 - view.x0), view.z0 + (cy - PAD) / (H - 2 * PAD) * (view.z1 - view.z0)];

  // 해역 이름 자리 (캔버스 px). ⚠ 대표 향수(메도이드) 자리에 둔다 — 도착하는 곳과 이름이 같은 자리다
  let labels = [];

  // ⭐⭐ 팔레트 (2026-09-12 저녁 — docs/UI-디자인-개정.md §1). **색을 여기 적지 않는다** —
  //   `index.html` 의 `:root` 가 단일 출처이고 여기서는 읽기만 한다 (두 곳에 적으면 갈라진다, 불변식 2).
  //   ⚠ 이 토큰들은 **시간대를 타지 않는다** (자기 바탕이 있는 표면의 색이다) — 한 번만 읽으면 된다
  // ⭐ 2026-09-13 저녁 — **저녁 판**(<html data-mini-eve>)이면 `--pb-mini-c-*` 를 먼저 읽는다 (없으면 예전 표면 토큰 그대로 — 값 단위로 예전).
  //   ⚠ 그래서 PAL 은 한 번이 아니라 **판이 바뀔 때마다** 다시 읽는다 (update 가 속성을 본다)
  const readPal = () => {
    const r = getComputedStyle(document.documentElement);
    const g = (k, d) => ((r.getPropertyValue(k) || '').trim() || d);
    const surface = g('--pb-surface', '#F9F6EF'), ink = g('--pb-on-surface', '#2F2F32');
    return {
      surface:  g('--pb-mini-c-halo', surface),     // 점 · 이름 · 배의 테두리
      surface2: g('--pb-surface-2', '#E8E1D6'),
      line:     g('--pb-line-soft', '#C9C4BB'),
      ink:      g('--pb-mini-c-fog', ink),          // 안개
      fogA:     parseFloat(g('--pb-mini-c-fog-a', '0.52')) || 0.52,
      label:    g('--pb-mini-c-label', ink),        // 해역 이름
      rim:      g('--pb-mini-c-rim', surface),      // 갈 수 있는 바다의 끝선
      accent:   g('--pb-mini-c-accent', g('--pb-accent', '#A68F5B')),
      shimmer:  g('--pb-shimmer',   '#A7C8DB'),
      // 갈 수 없는 바다 — 해도와 **같은 토큰**이다 (2026-09-13, 연관성). 저녁 판은 한 단 더 내린 제 색을 쓴다
      void:     g('--pb-mini-c-void', g('--pb-void', '#515A61'))
    };
  };
  let PAL = readPal();
  let palEve = document.documentElement.hasAttribute('data-mini-eve');
  // #RRGGBB → rgba(). 팔레트 하나로 투명도만 달리 쓴다
  const rgba = (hex, a) => {
    const h = hex.replace('#', '');
    const n = parseInt(h.length === 3 ? h.split('').map(c => c + c).join('') : h, 16);
    return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
  };

  // ── 안개 격자 ─────────────────────────────────────────────
  const fog = { cols: 0, rows: 0, x0: 0, z0: 0, bits: null, n: 0, dirty: true, lastX: NaN, lastZ: NaN, key: '', saveAt: 0, unsaved: false };
  const fogOn = () => (P.minimapFog === undefined ? 1 : P.minimapFog) >= 0.5;

  function fogInit() {
    // 격자는 **미니맵이 담는 사각형 전체**를 덮는다 (바깥 띠까지 — 거기도 어두워야 한다)
    const key = FOG_KEY + map.size + '|' + map.flipY;
    fog.cols = Math.max(1, Math.ceil((view.x1 - view.x0) / FOG_CELL));
    fog.rows = Math.max(1, Math.ceil((view.z1 - view.z0) / FOG_CELL));
    fog.x0 = view.x0; fog.z0 = view.z0;
    const bits = new Uint8Array(fog.cols * fog.rows);
    // 저장본은 **월드 좌표**로 적는다 (칸 번호가 아니다) — 여유(mapMargin)를 바꿔 격자가 달라져도 기록이 산다
    try {
      const raw = localStorage.getItem(key);
      if (raw) for (const s of raw.split(';')) {
        const [cx, cz] = s.split(',').map(Number);
        const i = Math.floor((cx - fog.x0) / FOG_CELL), j = Math.floor((cz - fog.z0) / FOG_CELL);
        if (i >= 0 && j >= 0 && i < fog.cols && j < fog.rows) bits[j * fog.cols + i] = 1;
      }
    } catch (e) { /* 사생활 모드 · 저장소 막힘 — 이번 세션만 기억한다 */ }
    fog.bits = bits; fog.key = key;
    fog.n = bits.reduce((a, b) => a + b, 0);
    mask.width = fog.cols; mask.height = fog.rows;
    fog.dirty = true; fog.lastX = NaN;
  }
  function fogSave(force) {
    if (!fog.bits || !fog.unsaved) return;
    const now = performance.now();
    if (!force && now - fog.saveAt < 2000) return;   // ⚠ 2초에 한 번만 — 매 프레임 쓰면 저장소가 느려진다
    fog.saveAt = now; fog.unsaved = false;
    const out = [];
    for (let j = 0; j < fog.rows; j++) for (let i = 0; i < fog.cols; i++) {
      if (fog.bits[j * fog.cols + i]) out.push(Math.round(fog.x0 + (i + 0.5) * FOG_CELL) + ',' + Math.round(fog.z0 + (j + 0.5) * FOG_CELL));
    }
    try { localStorage.setItem(fog.key, out.join(';')); } catch (e) { /* 막히면 이번 세션만 */ }
  }
  // 배 둘레 R 을 밝힌다. ⚠ 배가 1 월드 넘게 움직였을 때만 돈다 (칸 수백 개 검사라 싸지만 매 프레임 할 일은 아니다)
  function reveal(x, z) {
    if (!fog.bits) return false;
    if (Math.hypot(x - fog.lastX, z - fog.lastZ) < 1) return false;
    fog.lastX = x; fog.lastZ = z;
    const R = Math.max(1, P.minimapRevealR === undefined ? 26 : P.minimapRevealR);
    const i0 = Math.max(0, Math.floor((x - R - fog.x0) / FOG_CELL)), i1 = Math.min(fog.cols - 1, Math.floor((x + R - fog.x0) / FOG_CELL));
    const j0 = Math.max(0, Math.floor((z - R - fog.z0) / FOG_CELL)), j1 = Math.min(fog.rows - 1, Math.floor((z + R - fog.z0) / FOG_CELL));
    let changed = false;
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      const k = j * fog.cols + i;
      if (fog.bits[k]) continue;
      const cx = fog.x0 + (i + 0.5) * FOG_CELL, cz = fog.z0 + (j + 0.5) * FOG_CELL;
      if ((cx - x) ** 2 + (cz - z) ** 2 <= R * R) { fog.bits[k] = 1; fog.n++; changed = true; }
    }
    if (changed) { fog.dirty = true; fog.unsaved = true; }
    return changed;
  }
  function drawFog() {
    fog.dirty = false;
    // ① 마스크 — 가 본 칸만 불투명 흰색
    const img = mctx.createImageData(fog.cols, fog.rows);
    for (let k = 0; k < fog.bits.length; k++) if (fog.bits[k]) { const o = k * 4; img.data[o] = img.data[o + 1] = img.data[o + 2] = 255; img.data[o + 3] = 255; }
    mctx.putImageData(img, 0, 0);
    // ② 안개 — 미니맵 전체를 어둡게 칠하고 마스크 자리를 **부드럽게** 도려낸다
    fctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    fctx.globalCompositeOperation = 'source-over';
    fctx.clearRect(0, 0, W, H);
    fctx.fillStyle = rgba(PAL.ink, PAL.fogA);   // 암흑 시야 — CHARCOAL 0.52 (저녁 판은 --pb-mini-c-fog · -fog-a).
    // ⚠ 2026-09-12 저녁 : 0.82 → **0.52** (사용자 : *"미탐색 영역 너무 어둡고"*). 점(향조 색)과
    //   라벨이 그 위에서 읽힐 만큼만 덮는다 — 통째로 덮으면 지도가 아니라 검은 판이 된다
    fctx.fillRect(0, 0, W, H);
    fctx.globalCompositeOperation = 'destination-out';
    fctx.imageSmoothingEnabled = true;
    if ('imageSmoothingQuality' in fctx) fctx.imageSmoothingQuality = 'high';
    // ⚠ 칸이 크면 계단이 보인다 — 흐림을 한 겹 준다 (지원 안 하는 브라우저는 쌍선형만으로 그린다)
    if ('filter' in fctx) fctx.filter = 'blur(2.5px)';
    const [ax, ay] = toC(fog.x0, fog.z0), [bx, by] = toC(fog.x0 + fog.cols * FOG_CELL, fog.z0 + fog.rows * FOG_CELL);
    fctx.drawImage(mask, ax, ay, bx - ax, by - ay);
    if ('filter' in fctx) fctx.filter = 'none';
    fctx.globalCompositeOperation = 'source-over';
  }


  function layout() {
    const cw = cv.clientWidth || 212;
    // ── 담는 사각형. 범위가 켜져 있으면 갈 수 있는 바다 + 바깥 띠
    if (boundOn()) {
      const n = map.navRect(margin() + BAND);
      view = { x0: n.x0, x1: n.x1, z0: n.z0, z1: n.z1 };
      PAD = 3;
    } else {
      view = { ...map.bounds };
      PAD = 8;
    }
    // ⚠ 범위가 꺼져 있으면 예전 식 그대로 (여백까지 한 비율로 — 비교 패널 [원본] 이 예전과 같은 그림이어야 한다)
    const ratio = (view.z1 - view.z0) / (view.x1 - view.x0);
    W = cw; H = boundOn() ? Math.round((cw - 2 * PAD) * ratio + 2 * PAD) : Math.round(cw * ratio);
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    for (const c of [cv, stat, fogCv]) { c.width = Math.round(W * dpr); c.height = Math.round(H * dpr); }
    cv.style.height = H + 'px';
    drawStatic();
    fogInit();
    last = '';
  }

  function drawStatic() {
    sctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    sctx.clearRect(0, 0, W, H);
    // ── 갈 수 없는 바다 (범위 밖) — **한 색**. ⚠ 안개 **위**에 그린다 (정적 층이 안개보다 위다) — 어두운 곳에서도 '막힘' 이 읽혀야 한다
    if (boundOn()) {
      // ⭐⭐ 2026-09-13 (v0.50.0) — 빗금을 걷고 **`--pb-void` 한 색**으로 덮는다. 해도와 같은 토큰이다 (사용자 :
      //   *"확대했을때 빗금 표현은 몹시 안좋고 연관성을 만들어야하니 작은 미니맵에도 같은 색상으로"*).
      //   ⭐ 경계도 격자 그림(132×110 마스크 확대)이 아니라 **원들의 합집합 그 자체**다 — 배를 막는 식
      //     (main.js · `navDist ≤ navReach`)과 같은 모양이다. 계단도 흐림도 없다.
      //   ⚠ 이 캔버스가 **아직 비어 있을 때** 그린다 — `destination-out` 이 점·이름까지 지우지 않게
      //   ⚠ 모든 원을 같은 방향으로 그리므로 nonzero 채움이 곧 합집합이다
      const r = map.navReach * (W - 2 * PAD) / (view.x1 - view.x0);
      sctx.fillStyle = PAL.void;
      sctx.fillRect(0, 0, W, H);
      sctx.globalCompositeOperation = 'destination-out';
      sctx.beginPath();
      for (const p of map.points) { const [x, y] = toC(p.x, p.z); sctx.moveTo(x + r, y); sctx.arc(x, y, r, 0, Math.PI * 2); }
      sctx.fill();
      sctx.globalCompositeOperation = 'source-over';
      // 끝선 — 합집합의 **바깥 호만** (안쪽으로 겹친 호는 긋지 않는다). ⚠ 밝은 선이다 — 바깥이 어둡다
      const ol = map.navOutline();
      sctx.strokeStyle = rgba(PAL.rim, 0.85);
      sctx.lineWidth = 1.4;
      sctx.lineCap = 'round';
      sctx.beginPath();
      for (const a of ol.arcs) {
        const [x, y] = toC(a.x, a.z);
        sctx.moveTo(x + r * Math.cos(a.a0), y + r * Math.sin(a.a0));
        sctx.arc(x, y, r, a.a0, a.a1);
      }
      sctx.stroke();
    }
    // 지도 사각형 — 머리카락 선.
    // ⚠⚠ **범위가 켜져 있으면 안 그린다** (2026-09-12 저녁). v0.45.0 에서 갈 수 있는 바다가
    //   향수 분포를 따라 굽게 되자, 이 사각형이 그 경계와 나란히 놓여 **경계가 둘로 읽혔다**
    //   (화면으로 확인). 범위가 꺼져 있을 때만 지도의 끝을 알려 주는 선으로 남는다
    if (!boundOn()) {
      const [ax, ay] = toC(map.bounds.x0, map.bounds.z0), [bx, by] = toC(map.bounds.x1, map.bounds.z1);
      sctx.strokeStyle = rgba(PAL.line, 0.35); sctx.lineWidth = 1;
      sctx.strokeRect(ax + 0.5, ay + 0.5, bx - ax - 1, by - ay - 1);
    }
    // 향수 200개. ⚠ 색은 부표 색(families[].color) 그대로 — 3D 에서 본 색이 여기서도 같은 향조다
    // ⚠ 안개 위에서도 보여야 한다 (사용자 : *"어떤 향수 위치는 전부 보이게"*) — 안개가 켜져 있으면 점마다 가는 종이색 테두리를 둔다.
    //   꺼져 있으면 예전 그대로 (반지름 1.7 · 테두리 없음)
    const halo = fogOn();
    for (const p of map.points) {
      const [x, y] = toC(p.x, p.z);
      if (halo) { sctx.beginPath(); sctx.arc(x, y, 2.2, 0, Math.PI * 2); sctx.fillStyle = rgba(PAL.surface, 0.55); sctx.fill(); }
      sctx.fillStyle = p.fam.color;
      sctx.beginPath(); sctx.arc(x, y, halo ? 1.6 : 1.7, 0, Math.PI * 2); sctx.fill();
    }
    // 해역 이름. ⚠ 흰 테두리를 먼저 그어 점 위에서도 읽히게 한다 — 안개 위에서도 같은 이유로 읽힌다
    // ⚠ 글꼴을 **여기 적지 않는다** — 판(#minimap)이 #stage 에서 물려받은 것을 읽는다.
    //   2026-09-12 저녁 실측 : 1단계에서 DOM 을 Noto Serif KR 로 바꿨는데 이 줄만 'Pretendard' 로 남아
    //   캔버스 글자만 홀로 산세리프였다 (Pretendard 는 이제 안 받으므로 실제로는 system-ui 로 떨어졌다)
    sctx.font = '600 8px ' + (getComputedStyle(box).fontFamily || 'serif');
    sctx.textAlign = 'center'; sctx.textBaseline = 'middle';
    if ('letterSpacing' in sctx) sctx.letterSpacing = '1px';
    // ⚠ 이름이 캔버스 밖으로 나가지 않게 가장자리에서 밀어 넣는다 — AQUATIC 의 대표 향수가 지도 왼쪽 끝
    //   (x −157)이라 가운데 정렬하면 반이 잘렸다 ("UATIC", 화면으로 확인). 누르는 자리도 밀린 자리다
    labels = Object.entries(map.familyAnchors).map(([k, a]) => {
      const [ax2, y] = toC(a.x, a.z);
      const name = map.points.find(p => p.fam.key === k).fam.name;
      const hw = sctx.measureText(name).width * 0.5 + 2;
      const x = Math.min(W - hw, Math.max(hw, ax2));
      return { key: k, name, x, y, a };
    });
    for (const l of labels) {
      sctx.lineWidth = 3; sctx.strokeStyle = rgba(PAL.surface, 0.95);
      sctx.strokeText(l.name, l.x, l.y - 7);
      sctx.fillStyle = rgba(PAL.label, 0.78);
      sctx.fillText(l.name, l.x, l.y - 7);
    }
  }

  function draw() {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    // ⭐ 안개가 **맨 아래**다 — 점·이름(정적 층)이 그 위에 얹혀 어디서나 보인다
    if (fogOn()) { if (fog.dirty) drawFog(); ctx.drawImage(fogCv, 0, 0, W, H); }
    ctx.drawImage(stat, 0, 0, W, H);
    const [bx, by] = toC(boat.x, boat.z);
    // 지금 화면이 담는 바다 (배 기준 부채꼴 — main.js 가 투영으로 잰 것). 게임 미니맵의 '시야'
    if (foot && foot.length > 2) {
      const sx = (W - 2 * PAD) / (view.x1 - view.x0), sz = (H - 2 * PAD) / (view.z1 - view.z0);
      ctx.beginPath();
      foot.forEach((p, i) => { const x = bx + p[0] * sx, y = by + p[1] * sz; if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y); });
      ctx.closePath();
      ctx.fillStyle = rgba(PAL.shimmer, 0.16); ctx.fill();
      ctx.strokeStyle = rgba(PAL.shimmer, 0.55); ctx.lineWidth = 0.9; ctx.stroke();
    }
    // 호버한 해역 — 이름 밑에 짧은 줄
    if (hover && hover.label) {
      const l = hover.label;
      ctx.strokeStyle = rgba(PAL.accent, 0.95); ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.moveTo(l.x - 12, l.y - 1); ctx.lineTo(l.x + 12, l.y - 1); ctx.stroke();
    }
    // 가는 곳 — 점선과 고리
    if (target) {
      const [tx, ty] = toC(target.x, target.z);
      ctx.setLineDash([2, 3]); ctx.strokeStyle = rgba(PAL.accent, 0.85); ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(tx, ty); ctx.stroke(); ctx.setLineDash([]);
      ctx.beginPath(); ctx.arc(tx, ty, 4, 0, Math.PI * 2); ctx.stroke();
    }
    // 배 — 뱃머리를 향한 작은 삼각형. ⚠ 뱃머리의 월드 방향 (−sin h, −cos h) → 캔버스는 z 가 아래라 같은 부호
    const fx = -Math.sin(boat.head), fy = -Math.cos(boat.head);
    const r = 5, w = 3.2;
    ctx.fillStyle = PAL.accent;
    ctx.beginPath();
    ctx.moveTo(bx + fx * r, by + fy * r);
    ctx.lineTo(bx - fx * r * 0.6 - fy * w, by - fy * r * 0.6 + fx * w);
    ctx.lineTo(bx - fx * r * 0.6 + fy * w, by - fy * r * 0.6 - fx * w);
    ctx.closePath();
    // 안개 위에서도 보이게 종이색 테두리 (안개가 꺼져 있으면 예전 그대로)
    if (fogOn()) { ctx.strokeStyle = rgba(PAL.surface, 0.95); ctx.lineWidth = 1.4; ctx.stroke(); }
    ctx.fill();
  }

  const idleHint = () => {
    if (!hint) return;
    if (fogOn() && fog.bits) {
      // 탐색률 — 갈 수 있는 바다(범위 안) 기준이 아니라 격자 전체 기준이라 대략이다
      hint.textContent = '탐색 ' + Math.round(100 * fog.n / Math.max(1, fog.bits.length)) + '%';
    } else hint.textContent = '—';
  };

  // ── 누르기 · 호버. 캔버스 px → 월드 → 해역
  const hitAt = (e) => {
    const r = cv.getBoundingClientRect();
    const cx = e.clientX - r.left, cy = e.clientY - r.top;
    let label = null, best = LABEL_R;
    for (const l of labels) { const d = Math.hypot(cx - l.x, cy - (l.y - 4)); if (d < best) { best = d; label = l; } }
    const [x, z] = toW(cx, cy);
    // ⚠ 범위 밖(`--pb-void` 로 칠한 곳)은 해역이 아니다 — 누르면 가지 않고 경고만 (onBlocked)
    // ⚠ 2026-09-13 : 여유(mapMargin) 없이 **그린 경계 그대로** 판정한다. 바깥을 한 색으로 칠하자 그 안쪽 20 월드를
    //   누르면 떠나는 것이 '갈 수 없는 바다를 눌렀는데 간다' 로 읽혔다 — 그림과 판정이 같아야 한다
    const out = boundOn() && !map.inNav(x, z, 0);
    const reg = out ? null : map.regionAt(x, z);
    return { label: out ? null : label, x, z, reg, out };
  };
  const onMove = (e) => {
    if (!map) return;
    const h = hitAt(e);
    hover = h;
    if (hint) hint.textContent = h.out ? '범위 없음' : h.label ? h.label.name : (h.reg ? h.reg.name + ' 해역' : '—');
    last = '';   // 다시 그린다
  };
  const onLeave = () => { hover = null; idleHint(); last = ''; };
  const onClick = (e) => {
    if (!map) return;
    const h = hitAt(e);
    if (h.out) { onBlocked && onBlocked(); return; }
    if (h.label) onPick && onPick({ key: h.label.key, name: h.label.name, x: h.label.a.x, z: h.label.a.z, custom: true });
    else if (h.reg) onPick && onPick({ key: h.reg.key, name: h.reg.name, x: h.x, z: h.z, custom: true, spot: true });
  };
  // ⚠ 방향키가 조타로 새지 않게 — 캔버스에 초점이 가도 키를 가두지는 않는다 (버튼이 아니다)
  cv.addEventListener('pointermove', onMove);
  cv.addEventListener('pointerleave', onLeave);
  cv.addEventListener('click', onClick);
  const onResize = () => { if (map) layout(); };
  window.addEventListener('resize', onResize);
  // 탭을 닫을 때 마지막 기록을 남긴다
  const onHide = () => fogSave(true);
  window.addEventListener('pagehide', onHide);

  return {
    // map : marks.map (없으면 숨긴다) · boat : {x, z(월드), head} · target : 가는 곳(월드) · foot : 배 기준 부채꼴
    update({ map: m, boat: b, target: t, foot: f }) {
      // ⭐ 저녁 판 (2026-09-13 저녁, <html data-mini-eve>) — 판이 바뀌면 캔버스 색을 다시 읽고 정적 층 · 안개를 다시 굽는다
      const eve = document.documentElement.hasAttribute('data-mini-eve');
      if (eve !== palEve) { palEve = eve; PAL = readPal(); if (map) { drawStatic(); fog.dirty = true; } last = ''; }
      const want = !!m && (P.minimapOn === undefined ? 1 : P.minimapOn) >= 0.5;
      if (want !== visible) { visible = want; box.style.visibility = want ? 'visible' : 'hidden'; }
      if (!want) return;
      // ⚠ 안개를 켜고 끄면 정적 층(점 테두리)도 달라진다 — 키에 넣는다
      const k = m.size + '|' + m.minGap + '|' + m.flipY + '|' + (boundOn() ? margin() + '@' + m.navReach : 'x') + '|' + (fogOn() ? 1 : 0);
      if (m !== map || k !== mapKey) { map = m; mapKey = k; layout(); idleHint(); }
      boat = b; target = t; foot = f;
      // ⭐ 안개 — 배 둘레를 밝힌다. ⚠ 안개를 꺼 둬도 **기록은 계속한다** — 켰을 때 그동안 지나온 곳이 보여야 한다
      if (reveal(b.x, b.z)) { if (!hover) idleHint(); }
      fogSave(false);
      // ⚠ 값이 실제로 달라질 때만 그린다 — 배는 0.1 월드, 방향은 0.02 rad 단위로 본다
      const key = [Math.round(b.x * 10), Math.round(b.z * 10), Math.round(b.head * 50),
        t ? Math.round(t.x) + ',' + Math.round(t.z) : '-', hover ? (hover.label ? hover.label.key : hover.out ? 'o' : 'r') : '-',
        f ? f.length : 0, fogOn() ? fog.n : -1].join('|');
      if (key === last) return;
      last = key;
      draw();
    },
    // ⭐ 안개 격자를 **읽기만** 넘긴다 (2026-09-12 저녁 — 해도가 같은 안개를 깐다).
    //   ⚠⚠ 주인은 여기다 — 기록(localStorage) · 밝히기(reveal) 는 미니맵만 한다. 해도는 이 격자로
    //     작은 그림 한 장을 만들어 SVG 마스크에 넣는다 (chart.js `buildFog`). 두 곳에서 쓰면 갈라진다
    fogMask() {
      if (!fog.bits || !fogOn()) return null;
      return { cols: fog.cols, rows: fog.rows, cell: FOG_CELL, x0: fog.x0, z0: fog.z0, n: fog.n, bits: fog.bits };
    },
    // 탐색 기록을 지운다 (콘솔 · 시연 준비용)
    resetFog() {
      try { if (fog.key) localStorage.removeItem(fog.key); } catch (e) { /* 막혀도 지운다 */ }
      if (fog.bits) { fog.bits.fill(0); fog.n = 0; fog.dirty = true; fog.lastX = NaN; }
      last = ''; idleHint();
      return 'fog reset';
    },
    fogReport() {
      if (!fog.bits) return '안개 없음';
      return `안개 ${fog.cols}×${fog.rows} 칸 (칸 ${FOG_CELL} 월드) · 밝힌 칸 ${fog.n} (${(100 * fog.n / fog.bits.length).toFixed(1)}%) · 키 ${fog.key}`;
    },
    dispose() {
      fogSave(true);
      cv.removeEventListener('pointermove', onMove);
      cv.removeEventListener('pointerleave', onLeave);
      cv.removeEventListener('click', onClick);
      window.removeEventListener('resize', onResize);
      window.removeEventListener('pagehide', onHide);
      box.style.visibility = 'hidden';
    }
  };
}
