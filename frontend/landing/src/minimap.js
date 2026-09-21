import { PARAMS as P } from './params.js';

// ───────── 미니맵 (2026-09-11, v0.32.0) ─────────
// 향수 지도(scentmap.js)를 위에서 본 **추상 지도**다. 사용자 : *"미니맵을 만드는데 사실상 미니맵과 화면의
//   연출은 조금 달라야할 것 같음 · 웹 항해 게임이라 생각하고"*.
//   그래서 3D 바다를 줄여 그리지 않는다 — 점 · 해역 이름 · 배 화살표 · 지금 있는 바다의 원만 그린다.
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
//        안개(어두움, 구멍) → **점 · 해역 이름**(정적 층) → 시야 원 · 목표 · 배
//      그래서 안개가 점과 이름을 **덮지 않는다.** 기록은 localStorage (지도 크기별 키) — 지우기 `PB.minimap.resetFog()`.
//      ⚠ 순간이동(흰 안개)으로 건너뛴 바다는 밝아지지 않는다 — '지나온' 곳이 아니다. 도착한 자리만 밝아진다
//   ② **범위 없음** (`mapBound`) — 지도 사각형 + mapMargin 밖을 **빗금 띠**로 그린다. 거기를 누르면 가지 않고 경고만 띄운다
//      (onBlocked → main.js → ui.warn). 배가 그 선에 닿을 때도 같은 경고다 (main.js).
//      ⭐ 2026-09-13 (v0.50.0) : 빗금이 아니라 **`--pb-void` 한 색**이고, 경계는 **원들의 합집합을 정확한 호로** 그린다
//        (`scentmap.navLoops` — 2026-09-18 부터 부드러운 고리다) — 해도와 같은 색 · 같은 모양이다 (사용자 : *"연관성을 만들어야하니 작은 미니맵에도 같은 색상으로"*)

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
  // 정적 층이 구워질 때의 안개 상태 — `statSeen` 이 달라질 때만 다시 굽는다 (update 의 머리말)
  let statFogN = -1, statSeen = -1;
  let boat = { x: 0, z: 0, head: 0 }, target = null, sight = 0;
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
  // 이름을 그린 글꼴 · 크기. 호버 강조가 **같은 글자를 같은 자리에** 다시 그리므로 정적 층에서 받아 둔다 (불변식 2)
  let labelFont = '', labelPx = 8;

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
  /*
   * ⭐⭐ **미니맵의 향조 색은 거의 무채색이다** (2026-09-21 사용자 : *"각 향조마다 색상이 밝게 표현되어
   *   있는 부분을 다 아주 약간 무채색에 가깝게 표현해야함"* — 개인화 추천이 이 자리를 쓴다).
   *   채도만 빼고 **명도는 남긴다** (chart.js 의 `desat` 과 같은 식 · 불변식 2 의 규율로 두 곳이 같은 계산).
   *   ⚠ 부표 색이 **일부러 등휘도**라(불변식 21 : 선형 휘도 0.33~0.45) 채도를 전부 빼면 아홉이 **한 회색**이
   *     된다 (불변식 29-2 가 같은 함정을 적어 뒀다). 그래서 1 이 아니라 0.78 — *"아주 약간"* 남긴다.
   *   ⚠ 해도(`chart.js`)의 향 영역은 따로다 (`TERR_DESAT` 0.18) — 거기는 면이라 색이 더 필요하다.
   */
  const MINI_DESAT = 0.78;
  /*
   * ⭐ **탐색한 곳은 색이 조금 돌아온다** (2026-09-21 사용자 : *"지역을 탐색했을때는 채도를 조금 올려줄
   *   수 있나? 무채색을 빼고? 너무 채도를 올리면 그 영역이 튀어나올 수 도있으니 색상만 좀 보정"*).
   *   해도가 이미 쓰는 규율과 **같은 말**이다 — 불변식 29-2 : *"지나온 바다에는 색이 한 겹 더 얹힌다 —
   *   탐색하면 색이 돌아온다"*. 미니맵에만 없던 것을 맞춘 것이다.
   *   ⚠ 제 색(0)으로 돌려주지 않는다 — 그러면 탐색한 해역이 **튀어나온다** (사용자가 먼저 짚었다).
   *     0.78 → 0.58 이라 채도가 약 **1.8배**만 오른다 (CITRUS 0.11 → 0.19).
   */
  const MINI_DESAT_SEEN = 0.58;
  // 해역 이름 호버의 계열 강조 — 0 이면 안 그린다 (아래 `MINI_FAM_GLOW` 머리말)
  const MINI_FAM_GLOW = 0;
  const desat = (hex, k) => {
    const h = (hex || '').trim();
    if (h[0] !== '#' || h.length !== 7) return h;
    const r = parseInt(h.slice(1, 3), 16), g = parseInt(h.slice(3, 5), 16), b = parseInt(h.slice(5, 7), 16);
    const y = 0.299 * r + 0.587 * g + 0.114 * b;
    const m = (v) => Math.round(v + (y - v) * k).toString(16).padStart(2, '0');
    return '#' + m(r) + m(g) + m(b);
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
  // 그 자리가 밝혀진 칸인가 — `reveal` 의 칸 계산과 **같은 식**이어야 한다 (두 곳에 적으면 갈라진다)
  function seenAt(x, z) {
    if (!fog.bits) return false;
    const i = Math.floor((x - fog.x0) / FOG_CELL), j = Math.floor((z - fog.z0) / FOG_CELL);
    if (i < 0 || j < 0 || i >= fog.cols || j >= fog.rows) return false;
    return !!fog.bits[j * fog.cols + i];
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
    fctx.globalCompositeOperation = 'source-over';
    /*
     * ⭐⭐ **지나온 바다에 옅은 빛 한 겹** (2026-09-20 — 밝기 사다리의 둘째 칸).
     *   사용자 : *"현재 있는 부분이 제일 밝게 … 그다음 지나온 곳은 2번째 어둡게 갈 수 없는곳은 제일 어둡게"*.
     *   구멍만 뚫으면 '지나온 곳' 은 그냥 **판 바탕**이라 안 지나온 곳과의 차이가 안개 한 겹(0.42)뿐이다.
     *   ⚠⚠ 그 차이를 **안개를 더 어둡게 해서** 벌리지 않는다 — 2026-09-12 에 0.82 → 0.52 로 내린 이유가
     *     *"미탐색 영역 너무 어둡고"* 였다. 그래서 반대로 **지나온 쪽을 밝힌다.**
     *   같은 마스크를 흰색 그대로 얹으면 그게 곧 빛이다 (마스크는 가 본 칸만 불투명한 흰색이다).
     */
    fctx.globalAlpha = 0.16;
    fctx.drawImage(mask, ax, ay, bx - ax, by - ay);
    fctx.globalAlpha = 1;
    if ('filter' in fctx) fctx.filter = 'none';
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
      // ⭐⭐ 2026-09-18 : **해도와 같은 고리**를 긋는다 (`scentmap.navLoops` — 불변식 21 · 28).
      //   예전에는 원 200개를 그대로 뚫고 끝선은 그 **정확한 바깥 호**였다. 반지름이 같은 원들이라
      //   만나는 자리마다 오목한 뾰족점이 생겨 테두리가 물결쳤다 — 해도에서 사용자가 짚은 '구름' 이
      //   이 모양이다 (*"구름모양처럼 뭉개뭉개있으면 안될 것같고"*).
      //   ⚠⚠ 해도만 고치면 같은 바다가 **두 모양**이 된다 (실제로 09-18 에 그 상태를 한 번 거쳤다).
      //   ⚠ 면과 끝선이 **같은 경로**라 둘이 갈라질 수가 없다 — 한 번 훑는 함수를 두 번 부른다
      const loops = map.navLoops();
      const trace = () => {
        sctx.beginPath();
        for (const lp of loops) {
          for (let i = 0; i < lp.length; i++) {
            const [x, y] = toC(lp[i][0], lp[i][1]);
            if (i) sctx.lineTo(x, y); else sctx.moveTo(x, y);
          }
          sctx.closePath();
        }
      };
      sctx.fillStyle = PAL.void;
      sctx.fillRect(0, 0, W, H);
      sctx.globalCompositeOperation = 'destination-out';
      trace();
      // ⚠ **evenodd** — 바다 속에 갈 수 없는 웅덩이가 생기면 뚫리지 않아야 한다 (해도의 fill-rule 과 같다)
      sctx.fill('evenodd');
      sctx.globalCompositeOperation = 'source-over';
      /*
       * ⭐⭐ **끝선을 걷고 경계를 녹인다** (2026-09-20 사용자 : *"흰색 외곽선을 없애고 나갈 수 없는
       *   부분을 더 어둡게 표시해주고 경계부분을 블러처리해서 자연스러운 미니맵"*).
       *   예전에는 `rgba(PAL.rim, 0.85)` 짜리 1.4px 흰 선 한 줄이 경계의 전부였다 — 딱 잘린 금이라
       *   '갈 수 있는 바다' 가 지도가 아니라 도형으로 읽혔다.
       *   ⚠⚠ 이 선은 **두 번 뒤집힌 이력**이 있다 (불변식 28 : 바깥이 종이였을 땐 먹색, `--pb-void` 로
       *     어두워지며 상아색). 이제 셋째로 **없앤다** — 경계를 말하는 것은 이제 밝기 낙차뿐이다.
       * 어둠을 안쪽으로 **번지게** 해서 두 면을 잇는다 : 고리 안쪽만 남기고(clip) 같은 고리를 굵고
       *   흐리게 덧긋는다. 바깥은 이미 꽉 찬 void 라 번짐이 밖으로는 안 보인다.
       * ⚠ `filter` 를 못 쓰는 브라우저면 이 겹만 건너뛴다 — 딱 잘린 예전 경계로 떨어질 뿐 안 깨진다.
       */
      if ('filter' in sctx) {
        sctx.save();
        trace();
        sctx.clip('evenodd');
        sctx.filter = 'blur(3px)';
        sctx.strokeStyle = rgba(PAL.void, 0.9);
        sctx.lineWidth = 9;
        sctx.lineCap = 'round';
        sctx.lineJoin = 'round';
        trace();
        sctx.stroke();
        sctx.restore();
      }
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
      // ⚠ 제 색이 아니라 **채도를 뺀 색**이다 (MINI_DESAT 머리말) — 밝은 향조 색은 개인화 추천 몫으로 비워 둔다.
      //   ⭐ 탐색한 칸 위의 점만 채도를 조금 돌려받는다 (MINI_DESAT_SEEN)
      sctx.fillStyle = desat(p.fam.color, halo && seenAt(p.x, p.z) ? MINI_DESAT_SEEN : MINI_DESAT);
      sctx.beginPath(); sctx.arc(x, y, halo ? 1.6 : 1.7, 0, Math.PI * 2); sctx.fill();
    }
    // 해역 이름. ⚠ 흰 테두리를 먼저 그어 점 위에서도 읽히게 한다 — 안개 위에서도 같은 이유로 읽힌다
    // ⚠ 글꼴을 **여기 적지 않는다** — 판(#minimap)이 #stage 에서 물려받은 것을 읽는다.
    //   2026-09-12 저녁 실측 : 1단계에서 DOM 을 Noto Serif KR 로 바꿨는데 이 줄만 'Pretendard' 로 남아
    //   캔버스 글자만 홀로 산세리프였다 (Pretendard 는 이제 안 받으므로 실제로는 system-ui 로 떨어졌다)
    // ⭐ 글자 크기가 판 폭을 따라간다 (2026-09-20) — 판이 넓어졌는데 8px 로 못 박아 두면 지도만 커지고 이름은 더 작아 보인다.
    //   ⚠ 좁은 단계에서 8 아래로는 안 내려간다 (읽히는 바닥) · 11 위로는 안 올린다 (이름이 점을 덮는다)
    const labelFs = Math.max(8, Math.min(11, Math.round(W / 26)));
    labelPx = labelFs;
    labelFont = '600 ' + labelFs + 'px ' + (getComputedStyle(box).fontFamily || 'serif');
    sctx.font = labelFont;
    sctx.textAlign = 'center'; sctx.textBaseline = 'middle';
    if ('letterSpacing' in sctx) sctx.letterSpacing = '1px';
    // ⚠ 이름이 캔버스 밖으로 나가지 않게 가장자리에서 밀어 넣는다 — AQUATIC 의 대표 향수가 지도 왼쪽 끝
    //   (x −157)이라 가운데 정렬하면 반이 잘렸다 ("UATIC", 화면으로 확인). 누르는 자리도 밀린 자리다
    // ⭐⭐ **겹치면 위아래로 비킨다** (2026-09-20). 아홉을 대표 향수 자리에 그대로 찍으면 작은 판에서 서로 물린다 —
    //   1920 실측 : AQUATIC 과 GREEN 이 겹치고 CITRUS 가 배 삼각형을 덮었다.
    //   해도(chart.js)의 규율은 *"순위가 높은 것부터 놓고 겹치면 건너뛴다"* 인데, 미니맵은 아홉이 이름의 전부라
    //   **건너뛰면 해역 하나가 지도에서 사라진다.** 그래서 먼저 비킬 자리를 찾고, 다섯 자리가 다 막혔을 때만 접는다.
    //   ⚠ **큰 해역부터** 자리를 잡는다 (점이 많은 쪽이 먼저) — 비키는 쪽이 작은 해역이라야 지도가 덜 틀어진다
    //   ⚠ 접은 이름은 `labels` 에서도 뺀다 — 안 보이는 글자에 누르는 자리만 남겨 두지 않는다
    const OFF = [-7, 9, -18, 20, -29];   // 앵커에서 글자 중심까지. 첫 값 −7 이 예전 자리다 (안 겹치면 예전과 같은 그림)
    const fams = Object.entries(map.familyAnchors).map(([k, a]) => {
      const [ax2, y] = toC(a.x, a.z);
      const name = map.points.find(p => p.fam.key === k).fam.name;
      let n = 0; for (const p of map.points) if (p.fam.key === k) n++;
      const hw = sctx.measureText(name).width * 0.5 + 2;
      const x = Math.min(W - hw, Math.max(hw, ax2));
      return { key: k, name, x, y, a, hw, n };
    }).sort((p, q) => q.n - p.n);
    const taken = [];
    const overlaps = (b) => taken.some(o => o.x0 < b.x1 && o.x1 > b.x0 && o.y0 < b.y1 && o.y1 > b.y0);
    labels = [];
    for (const f of fams) {
      let ty = null;
      for (const dy of OFF) {
        const cy = f.y + dy;
        if (cy - labelFs < 0 || cy + labelFs > H) continue;   // 판 밖으로는 안 내보낸다
        const b = { x0: f.x - f.hw - 1, x1: f.x + f.hw + 1, y0: cy - labelFs * 0.62, y1: cy + labelFs * 0.62 };
        if (overlaps(b)) continue;
        taken.push(b); ty = cy; break;
      }
      if (ty === null) continue;
      labels.push({ key: f.key, name: f.name, x: f.x, y: f.y, ty, hw: f.hw, a: f.a });
    }
    for (const l of labels) {
      sctx.lineWidth = 3; sctx.strokeStyle = rgba(PAL.surface, 0.95);
      sctx.strokeText(l.name, l.x, l.ty);
      sctx.fillStyle = rgba(PAL.label, 0.78);
      sctx.fillText(l.name, l.x, l.ty);
    }
  }

  function draw() {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    // ⭐ 안개가 **맨 아래**다 — 점·이름(정적 층)이 그 위에 얹혀 어디서나 보인다
    if (fogOn()) { if (fog.dirty) drawFog(); ctx.drawImage(fogCv, 0, 0, W, H); }
    ctx.drawImage(stat, 0, 0, W, H);
    const [bx, by] = toC(boat.x, boat.z);
    /*
     * ⭐⭐ **지금 있는 바다 — 반지름 하나짜리 원, 테두리 없음** (2026-09-20 사용자 :
     *   *"정확한 원형 형태로 유지하되 … 경계선이 구별되어있지않고 그라데이션이든, 블러처리든 해서 부드럽게"*).
     *   예전에는 `main.js` 의 `footprint(cam)` 이 화면 테두리 16점을 투영한 **부채꼴**을 넘겼다 —
     *   가까운 쪽은 절두체 모양이고 먼 쪽만 38 로 눌려 구불구불했다. 그 38(`CONFIG.area.fade1`)이
     *   곧 '보이는 바다' 의 뜻이라 원 하나로 줄였다.
     * ⚠ **테두리 선을 긋지 않는다.** 선을 그으면 밝기 사다리의 제일 밝은 칸이 아니라 '영역' 이 된다 —
     *   지우려던 흰 끝선을 여기에 다시 그리는 셈이다.
     * ⚠ 가로·세로 배율을 따로 쓴다 — 범위가 켜져 있으면 둘이 같지만(layout 의 ratio), 꺼져 있으면 다르다.
     *   그때는 월드의 원이 판에서 타원이 되는 것이 맞다.
     */
    if (sight > 0) {
      const sx = (W - 2 * PAD) / (view.x1 - view.x0), sz = (H - 2 * PAD) / (view.z1 - view.z0);
      const rx = Math.max(1, sight * sx), ry = Math.max(1, sight * sz);
      ctx.save();
      ctx.translate(bx, by);
      ctx.scale(1, ry / rx);
      const g = ctx.createRadialGradient(0, 0, 0, 0, 0, rx);
      g.addColorStop(0, rgba(PAL.shimmer, 0.34));
      g.addColorStop(0.55, rgba(PAL.shimmer, 0.20));
      g.addColorStop(1, rgba(PAL.shimmer, 0));
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(0, 0, rx, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }
    /*
     * ⛔⛔ **해역 이름 호버의 '계열이 빛나는' 강조는 껐다** (2026-09-21 사용자 : *"메인페이지에서 작은
     *   창에서의 마우스 올렸을때 향 영역 밝음은 없애도댐 여기에 개인화 추천 로직이 들어갈꺼라서"*).
     *   2026-09-20 에 사용자 지시로 넣었던 것을(*"플로러 계열의 색상들이 빛나는 효과"*) **되돌린 것이다** —
     *   취향이 바뀐 게 아니라 **이 자리를 개인화 추천이 쓸 것**이라 미리 비워 두는 결정이다.
     *   ⚠ 밝기로 무언가를 말하는 장치를 여기 다시 넣기 전에 그 로직과 겹치는지 먼저 본다.
     *   ⚠ 호버 자체는 살아 있다 (`hover` — 머리말 글귀 · 누르면 그 해역으로 간다). 그림만 안 그린다.
     *   ⚠ 되살리려면 `MINI_FAM_GLOW` 를 1 로. 코드는 그대로 두었다 (값 단위로 2026-09-20 그림이다).
     */
    if (MINI_FAM_GLOW && hover && hover.label && map) {
      const l = hover.label;
      const fam = map.points.find(p => p.fam.key === l.key);
      const col = (fam && fam.fam.color) || PAL.accent;
      const pulse = 0.75 + 0.25 * (0.5 + 0.5 * Math.sin(performance.now() / 420));

      ctx.save();
      ctx.fillStyle = rgba(PAL.ink, 0.46);
      ctx.fillRect(0, 0, W, H);

      // 그 향조의 점 — 번짐 한 겹(넓고 옅게) 위에 심 한 겹. ⚠ shadowBlur 는 쌓이므로 두 번에 나눠 그린다
      ctx.shadowColor = col;
      ctx.shadowBlur = 7 * pulse;
      ctx.fillStyle = col;
      for (const p of map.points) {
        if (p.fam.key !== l.key) continue;
        const [x, y] = toC(p.x, p.z);
        ctx.beginPath(); ctx.arc(x, y, 2.3, 0, Math.PI * 2); ctx.fill();
      }
      ctx.shadowBlur = 0;
      ctx.fillStyle = rgba(PAL.surface, 0.9);
      for (const p of map.points) {
        if (p.fam.key !== l.key) continue;
        const [x, y] = toC(p.x, p.z);
        ctx.beginPath(); ctx.arc(x, y, 0.9, 0, Math.PI * 2); ctx.fill();
      }

      // 이름도 그 색으로 — 정적 층의 것과 **같은 글꼴 · 같은 자리**라 겹쳐 쓰면 한 글자로 읽힌다
      ctx.font = labelFont;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      if ('letterSpacing' in ctx) ctx.letterSpacing = '1px';
      ctx.lineWidth = 3; ctx.strokeStyle = rgba(PAL.ink, 0.85);
      ctx.strokeText(l.name, l.x, l.ty);
      ctx.shadowColor = col; ctx.shadowBlur = 6 * pulse;
      ctx.fillStyle = col;
      ctx.fillText(l.name, l.x, l.ty);
      ctx.restore();
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
    // ⚠ 앵커(l.y)가 아니라 **글자가 실제로 놓인 자리**(l.ty)를 기준으로 잰다 — 겹쳐서 비킨 이름은 앵커에서 떨어져 있다 (2026-09-20).
    //   +3 은 예전(글자 y−7 · 판정 y−4)과 같은 '글자 조금 아래' 관계다
    for (const l of labels) { const d = Math.hypot(cx - l.x, cy - (l.ty + 3)); if (d < best) { best = d; label = l; } }
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
    // map : marks.map (없으면 숨긴다) · boat : {x, z(월드), head} · target : 가는 곳(월드) · sight : 보이는 바다의 반지름(월드)
    update({ map: m, boat: b, target: t, sight: g }) {
      // ⭐ 저녁 판 (2026-09-13 저녁, <html data-mini-eve>) — 판이 바뀌면 캔버스 색을 다시 읽고 정적 층 · 안개를 다시 굽는다
      const eve = document.documentElement.hasAttribute('data-mini-eve');
      if (eve !== palEve) { palEve = eve; PAL = readPal(); if (map) { drawStatic(); fog.dirty = true; } last = ''; }
      const want = !!m && (P.minimapOn === undefined ? 1 : P.minimapOn) >= 0.5;
      if (want !== visible) { visible = want; box.style.visibility = want ? 'visible' : 'hidden'; }
      if (!want) return;
      // ⚠ 안개를 켜고 끄면 정적 층(점 테두리)도 달라진다 — 키에 넣는다
      const k = m.size + '|' + m.minGap + '|' + m.flipY + '|' + (boundOn() ? margin() + '@' + m.navReach : 'x') + '|' + (fogOn() ? 1 : 0);
      if (m !== map || k !== mapKey) { map = m; mapKey = k; layout(); idleHint(); }
      boat = b; target = t; sight = g || 0;
      // ⭐ 안개 — 배 둘레를 밝힌다. ⚠ 안개를 꺼 둬도 **기록은 계속한다** — 켰을 때 그동안 지나온 곳이 보여야 한다
      if (reveal(b.x, b.z)) { if (!hover) idleHint(); }
      /*
       * ⭐ 점의 채도가 탐색을 따라가므로 **정적 층을 다시 구워야** 한다 (MINI_DESAT_SEEN 머리말).
       * ⚠⚠ `fog.n` 이 바뀔 때마다 굽지 않는다 — 배가 나아가면 칸은 쉴 새 없이 켜지는데 그 대부분은
       *   **향수가 없는 칸**이라 그림이 한 픽셀도 안 바뀐다. 200개의 탐색 여부를 세어 그 수가 달라질
       *   때만 굽는다 (200번 조회는 프레임당 해도 공짜고, 굽기는 향수를 처음 지날 때만 돈다).
       * ⚠ 안개가 꺼져 있으면(`halo` 가 false) 점 색이 탐색을 안 타므로 셀 필요도 없다.
       */
      if (fogOn() && fog.bits && fog.n !== statFogN) {
        statFogN = fog.n;
        let n = 0;
        for (const p of map.points) if (seenAt(p.x, p.z)) n++;
        if (n !== statSeen) { statSeen = n; drawStatic(); }
      }
      fogSave(false);
      // ⚠ 값이 실제로 달라질 때만 그린다 — 배는 0.1 월드, 방향은 0.02 rad 단위로 본다
      // ⚠ 해역 이름에 마우스가 올라가 있는 동안만 **시계를 키에 넣는다** — 빛이 숨을 쉬려면 매 장 다시 그려야 한다.
      //   호버가 아닐 때는 예전처럼 값이 바뀔 때만 그린다 (236px 판이라 호버 중의 30장/초는 싸다)
      const key = [Math.round(b.x * 10), Math.round(b.z * 10), Math.round(b.head * 50),
        t ? Math.round(t.x) + ',' + Math.round(t.z) : '-', hover ? (hover.label ? hover.label.key : hover.out ? 'o' : 'r') : '-',
        hover && hover.label ? Math.round(performance.now() / 33) : '-',
        Math.round(sight), fogOn() ? fog.n : -1].join('|');
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
