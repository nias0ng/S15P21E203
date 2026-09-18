import { PARAMS as P } from './params.js';
import { BAND as MINI_BAND } from './minimap.js';
import { areasNow } from './areas.js';
import { TERRAIN } from './terrain-data.js';
// 격자 → 부드러운 닫힌 고리 (안개 윤곽 · scentmap.navLoops 와 **같은 함수**다)
import { traceGrid } from './util.js';

// ───────── 전체 화면 해도 (2026-09-12 저녁, v0.48.0) ─────────
// 미니맵 머리말의 [확대] 를 누르면 열리는 **화면 가득한 지도**다. 사용자 : *"미니맵 확대 버전도
//   만들어야함"* → *"전체 화면 해도 선택 지도"* — 향조·향수 이름이 다 보이고 누르면 그 해역으로
//   떠난다 (docs/UI-디자인-개정.md §3-4). 미니맵이 '지금 어디인가' 라면 해도는 '어디로 갈까' 다.
//
// ⚠⚠⚠ **캔버스가 아니라 SVG 다.** 미니맵(minimap.js)은 층마다 비트맵을 구워 `drawImage` 로 합성한다
//   (v0.49.0 까지는 정적 층 · 안개 · 마스크 · 빗금 · 끝선 다섯). 214px 판에서는 그게 제일 싸지만 전체 화면에서는 뒤집힌다 :
//     · 층당 1920×1080×dpr² 비트맵 — dpr 2 면 **한 장 33MB**, 다섯 층이면 100MB 대다
//     · 구운 그림은 확대하면 **뭉갠다** — 해도는 확대해서 읽는 물건이다
//     · 값이 하나 바뀔 때마다 층을 통째로 다시 굽는다 (전체 화면에서는 그 비용이 프레임을 먹는다)
//   SVG 는 점·선·글자가 배율과 무관하게 또렷하고, 확대·이동이 `transform` 한 줄이며,
//   바뀐 것만 속성으로 고친다. 사용자 : *"SVG 나 새롭게 더 가볍게 제작할 수 있는 방향"*.
//
// ⚠⚠⚠ **이 해도에는 비트맵이 하나도 없다** (2026-09-13, v0.50.0). v0.48.0 ~ v0.49.0 에서는 격자인 두 층
//   (갈 수 있는 바다 132×110 · 안개 116×102)을 작은 그림으로 두고 `<mask>` 안에서 늘려 흐렸는데,
//   **6배 확대에서 칸이 45~58px 이 되어 흐린 계단**으로 보였다 (사용자 화면 : *"SVG 면 이렇게 blur 처리
//   되듯이 되면 안될텐데"*). 지금은 :
//     · 갈 수 있는 바다 = `scentmap.navLoops()` 의 **부드러운 고리** — 면과 끝선이 같은 경로다 (2026-09-18).
//       ⚠ v0.50.0 ~ 2026-09-17 은 원 200개의 합집합과 그 정확한 바깥 호였다. 반지름이 같은 원들이라
//         만나는 자리마다 오목한 뾰족점이 생겨 테두리가 물결쳤다 — 사용자가 본 '구름' 이다 (호 50개).
//       ⚠⚠ **미니맵도 같은 고리를 긋는다** (불변식 21 · 28) — 한쪽만 고치면 같은 바다가 두 모양이 된다.
//     · 안개 = 격자를 **마칭 스퀘어로 잇고 Chaikin 세 번**으로 둥글린 윤곽 (같은 `traceGrid`)
//   ⚠ 갈 수 없는 바다는 빗금이 아니라 **`--pb-void` 한 색**이다 (미니맵과 같은 토큰 — 연관성).
//
// ⚠ 좌표는 scentmap 월드 그대로다 (불변식 21). 화면 px 로 옮기는 식은 `sx/sy` 하나, 그 역이 `toW` 이고
//   바다 층의 SVG transform 도 **같은 값에서** 나온다 — 변환식을 두 곳에 적지 않는다.
// ⚠ 색은 `index.html` 의 `:root` 에서 읽는다 (minimap.js 의 `PAL` 과 같은 규율 — 불변식 2).
// ⚠⚠ 안개 기록의 **주인은 미니맵이다** (localStorage · 배가 지나갈 때 밝히기). 여기서는 `minimap.fogMask()`
//   로 읽기만 한다 — 같은 격자를 두 곳에서 쓰면 갈라진다.
// ⚠ 글자는 판 위에 앉으므로 `--pb-on-surface` 다 (`--pb-ink` 가 아니다 — 불변식 25).
//
// ⭐⭐⭐ 2026-09-12 저녁 (v0.49.0) — **향 영역이 데이터에서 온다** (`terrain-data.js`).
//   사용자가 지형 JSON 두 개를 주며 : *"향 영역이 첨부 파일처럼 구성이 될텐데 최대한 참고해서 현재
//   컨셉과 어울어지게"*. 아홉 향조의 영역 경계가 **이미 벡터 폴리곤**으로 들어 있다 (밀도 격자에서
//   뽑은 것). 격자 계단은 생성기가 다듬는다 (`scripts/terrain-from-json.mjs`).
//   ⚠ 색은 `CONFIG.families` 에서 받는다 (부표·점과 같은 색이라야 3D 에서 본 향조와 이어진다, 불변식 2).
//   ⚠ 향수 200개 중 **48개(24%)는 자기 향조 영역 밖에 있다** (원본 데이터의 성질이다 — 영역은
//     보로노이가 아니라 밀도 덩어리다). 점 색과 영역 색이 다른 자리는 버그가 아니다.
//   ⚠⚠ 2026-09-18 **뒤집혔다** — 영역마다 옅은 경계선을 두른다 (`gTerrEdge`). 여기 있던 *"선으로 두르지
//     않는다"* 는 색만으로 갈린다는 전제였는데, 사용자 판정은 *"향조 영역끼리의 경계"* 도 뭉개져 보인다였다.
//     맞닿은 변이 두 번 칠해지는 것은 그대로라 **평소 짙기를 0.4 로 묶어 둔다** (겹치면 0.64) — 올리면 티가 난다.
//     범례에 마우스를 올린 하나만 제 색으로 또렷해진다 (그때는 한 겹뿐이라 겹침이 없다).
//
// ⭐⭐ **이름은 지나온 바다에서만 적는다** (`chartNames` 1). 사용자 : *"내가 탐색한 이름만 노출"*.
//   안개 격자(미니맵이 주인)를 그대로 판정에 쓴다 — 영역과 점은 전부 보이고 **이름만** 가린다
//   (2026-09-11 의 *"어떤 영역, 어떤 향수 위치는 전부 보이게"* 를 깨지 않는다).

const NS = 'http://www.w3.org/2000/svg';
const svgEl = (n, a) => {
  const e = document.createElementNS(NS, n);
  if (a) for (const k in a) e.setAttribute(k, a[k]);
  return e;
};

const PADS = 10;          // 지도와 판 사이 여백 (px)
const SNAP = 15;          // 향수 점을 '눌렀다' 로 볼 반경 (px)
const LABEL_R = 20;       // 향조 이름을 '눌렀다' 로 볼 반경 (px)
const K_MAX = 6;          // 최대 배율. 200개가 가장 몰린 곳(최근접 중앙 6 월드)에서 이름이 다 펴지는 값
const NAME_CAP = 200;     // 이름은 많아도 향수 수만큼이다

export function createChart({ onPick, onBlocked, minimap } = {}) {
  const box = document.getElementById('chart');
  const stage = document.getElementById('chart-stage');
  const panel = document.getElementById('chart-panel');
  const legend = document.getElementById('chart-legend');
  const hintEl = document.getElementById('chart-hint');
  const btnOpen = document.getElementById('minimap-zoom');
  const btnClose = document.getElementById('chart-close');
  const btnReset = document.getElementById('chart-reset');
  const veil = document.getElementById('chart-veil');
  if (!box || !stage) {
    return { update() {}, open() {}, close() {}, isOpen: () => false, dispose() {}, report: () => '해도 없음' };
  }

  // ── 팔레트. ⚠ 색을 여기 적지 않는다 — `:root` 가 단일 출처다 (minimap.js 와 같은 규율)
  const PAL = (() => {
    const r = getComputedStyle(document.documentElement);
    const g = (k, d) => ((r.getPropertyValue(k) || '').trim() || d);
    return {
      surface: g('--pb-surface', '#F9F6EF'),
      surface2: g('--pb-surface-2', '#E8E1D6'),
      line: g('--pb-line-soft', '#C9C4BB'),
      ink: g('--pb-on-surface', '#2F2F32'),
      accent: g('--pb-accent', '#A68F5B'),
      shimmer: g('--pb-shimmer', '#A7C8DB'),
      // 갈 수 없는 바다 — 미니맵과 **같은 토큰**이다 (2026-09-13)
      void: g('--pb-void', '#515A61')
    };
  })();
  // 색에서 채도만 뺀다 (명도는 남긴다) — 미탐색 지형의 색이다. k 1 이면 완전 회색
  const desat = (hex, k) => {
    const h = (hex || '').trim();
    if (h[0] !== '#' || h.length !== 7) return h;
    const r = parseInt(h.slice(1, 3), 16), g = parseInt(h.slice(3, 5), 16), b = parseInt(h.slice(5, 7), 16);
    const y = 0.299 * r + 0.587 * g + 0.114 * b;
    const m = (v) => Math.round(v + (y - v) * k).toString(16).padStart(2, '0');
    return '#' + m(r) + m(g) + m(b);
  };
  const rgba = (hex, a) => {
    const h = (hex || '').trim();
    if (h[0] !== '#' || (h.length !== 7 && h.length !== 4)) return h;
    const f = h.length === 4 ? h.replace(/#(.)(.)(.)/, '#$1$1$2$2$3$3') : h;
    return `rgba(${parseInt(f.slice(1, 3), 16)},${parseInt(f.slice(3, 5), 16)},${parseInt(f.slice(5, 7), 16)},${a})`;
  };

  let open = false, map = null, mapKey = '';
  let W = 0, H = 0, s = 1, ox = 0, oy = 0;                 // 집 배치 (배율 1 일 때)
  let home = { x0: 0, x1: 1, z0: 0, z1: 1 };
  let k = 1, tx = 0, ty = 0;                               // 확대 · 이동
  let boat = { x: 0, z: 0, head: 0 }, target = null, foot = null;
  let hoverPt = null, fogN = -1, lastLive = '';
  let nameFs = 11, famFs = 13;

  const boundOn = () => (P.mapBound === undefined ? 1 : P.mapBound) >= 0.5;
  const margin = () => Math.max(0, P.mapMargin === undefined ? 20 : P.mapMargin);
  // 0 이름 없음 · 1 **지나온 바다만** (기본) · 2 전부 (시연용)
  const nameMode = () => Math.round(P.chartNames === undefined ? 1 : P.chartNames);
  const terrAmt = () => Math.max(0, Math.min(1, P.chartTerrain === undefined ? 1 : P.chartTerrain));

  // 월드 → 화면 px (확대 · 이동까지). ⚠ 북(−Z)이 위 — 미니맵과 같다 (불변식 0-2)
  const sx = (x) => (ox + (x - home.x0) * s) * k + tx;
  const sy = (z) => (oy + (z - home.z0) * s) * k + ty;
  const toW = (px, py) => [home.x0 + ((px - tx) / k - ox) / s, home.z0 + ((py - ty) / k - oy) / s];

  // ⭐ 안개가 걷힌 자리인가 — **미니맵의 격자를 그대로 읽는다** (기록의 주인은 미니맵이다, 불변식 28).
  //   ⚠ 격자 밖은 '안 지나갔다' 로 본다. 안개가 꺼져 있으면(fm 없음) 전부 지나간 것으로 본다
  const fogGrid = () => (minimap && minimap.fogMask && minimap.fogMask()) || null;
  const seen = (fm, x, z) => {
    if (!fm) return true;
    const i = Math.floor((x - fm.x0) / fm.cell), j = Math.floor((z - fm.z0) / fm.cell);
    if (i < 0 || j < 0 || i >= fm.cols || j >= fm.rows) return false;
    return !!fm.bits[j * fm.cols + i];
  };

  // ── SVG 뼈대. 한 번만 만든다
  const svg = svgEl('svg', { width: '100%', height: '100%' });
  svg.style.display = 'block';
  const defs = svgEl('defs');
  // ⭐⭐ 마스크 넷 — **전부 벡터 경로다** (2026-09-13, v0.50.0). 예전에는 격자 그림(132×110 · 116×102)을
  //   마스크 안에서 늘리고 흐렸다 — 6배 확대에서 칸이 45~58px 이 되어 **흐린 계단**으로 보였다 (사용자 화면).
  //   ⚠ 마스크 영역은 drawSea 가 판의 세 배로 잡는다 (기본 −10% ~ 120% 로 두면 확대·이동한 끝에서 잘린다)
  // 갈 수 있는 바다 **안쪽** — 원들의 합집합을 흰색으로
  const maskIn = svgEl('mask', { id: 'pbc-in', maskUnits: 'userSpaceOnUse' });
  const pInFill = svgEl('path', { fill: '#fff', 'fill-rule': 'evenodd' });
  maskIn.appendChild(pInFill);
  // 갈 수 있는 바다 **바깥** — 흰 판에서 합집합을 검게 뺀다
  const maskOut = svgEl('mask', { id: 'pbc-out', maskUnits: 'userSpaceOnUse' });
  const maskOutBg = svgEl('rect', { fill: '#fff' });
  const pOutFill = svgEl('path', { fill: '#000', 'fill-rule': 'evenodd' });
  maskOut.append(maskOutBg, pOutFill);
  // 안개 — 흰 판에서 **지나온 바다**를 검게 뺀다 (너울은 안 지나온 곳에만 얹힌다)
  const maskFog = svgEl('mask', { id: 'pbc-fog', maskUnits: 'userSpaceOnUse' });
  const maskFogBg = svgEl('rect', { fill: '#fff' });
  const pFogHole = svgEl('path', { fill: '#000', 'fill-rule': 'evenodd' });
  maskFog.append(maskFogBg, pFogHole);
  // ⭐ **지나온 바다만** — 향 영역의 '색이 돌아온 겹' 이 쓴다. ⚠ 안개가 꺼져 있으면 판 전체가 지나온 곳이다 (`maskLitAll`)
  const maskLit = svgEl('mask', { id: 'pbc-lit', maskUnits: 'userSpaceOnUse' });
  const maskLitAll = svgEl('rect', { fill: '#fff' });
  const pLitFill = svgEl('path', { fill: '#fff', 'fill-rule': 'evenodd' });
  maskLit.append(maskLitAll, pLitFill);
  defs.append(maskIn, maskOut, maskFog, maskLit);

  // 바다 층 — **집 좌표계**로 한 번 그려 두고 확대·이동은 transform 하나로 받는다 (DOM 을 다시 안 만든다)
  const gSea = svgEl('g');
  // ⭐⭐ **갈 수 없는 바다는 한 색이다** (2026-09-13, v0.50.0). 사용자 : *"영역밖은 완전한 검은색 보다 계열이
  //   좀 낮은 색상으로 칠해야 … 확대했을때 빗금 표현은 몹시 안좋고 연관성을 만들어야하니 작은 미니맵에도
  //   같은 색상으로"*. 색은 `--pb-void` 하나이고 미니맵과 **같은 토큰**이다. 빗금 무늬는 걷어냈다.
  //   ⚠ 판 전체를 덮는다 — 담는 사각형만 칠하면 그 **네모난 끝**이 어두운 색에서 그대로 드러난다
  const rVoid = svgEl('rect', { fill: PAL.void, mask: 'url(#pbc-out)' });
  // ⭐ **갈 수 있는 바다에 물빛을 깐다** (2026-09-12 저녁, 화면 판정). 갈 수 있는 바다가 '물' 로 읽혀야 지도가 된다
  const rSea = svgEl('rect', { fill: PAL.shimmer, 'fill-opacity': 0.12 });
  // ⭐⭐ 향 영역 아홉 — **두 겹이다** (2026-09-12 저녁, 화면 판정).
  //   ① `gTerr` 회색 지형 : 어디나 보인다 (2026-09-11 규약 *"어떤 영역은 전부 보이게"*)
  //   ② `gTerrLit` 색 : **지나온 바다에만** (마스크 `pbc-lit`) — 탐색하면 색이 돌아온다
  //   ⚠ 한 겹으로 두고 안개를 얹으면 색이 0.16 로 눌려 **아홉 향조가 한 회색으로 뭉친다** (화면으로 확인).
  //   ⚠ 면만 칠한다 (테두리 없음 · evenodd 라 고리 안의 고리는 구멍이 된다)
  const gTerr = svgEl('g', { 'fill-rule': 'evenodd' });
  const gTerrLit = svgEl('g', { 'fill-rule': 'evenodd', mask: 'url(#pbc-lit)' });
  // 해안선 — 육지 전체의 경계 한 겹. ⚠ 면이 아니라 **선**이다 (넷 중 셋이 지도 경계에서 열려 있다)
  // ⭐⭐ 향 영역의 **경계선** (2026-09-18). 사용자 : *"해당 목록에 마우스 오버했을때 그 영역의 경계면이
  //   밝게 표현된다던지"* · 향조끼리의 경계도 *"더 부드럽게"*.
  //   ⚠⚠ 불변식 29 는 *"영역을 선으로 두르지 않는다 — 이웃한 영역이 맞닿아 있어 공유 변이 두 번 그려진다"*
  //     였다. 여기서 **일부러 되돌린다** — 색만으로는 경계가 뭉개져 지도로 안 읽힌다는 판정이다.
  //     대신 평소에는 옅게(0.4) 둔다 : 두 번 칠해지는 공유 변이 0.64 가 되는데, 그 정도는
  //     '두 영역이 맞닿은 자리' 로 읽혀서 오히려 맞다. **짙게 올리면 그 겹침이 티가 난다.**
  //   ⭐ 마우스를 올린 한 영역만 제 색으로 또렷해진다 — 그때는 **한 겹뿐이라** 겹침 문제가 없다.
  const gTerrEdge = svgEl('g', { fill: 'none', 'stroke-linejoin': 'round', 'stroke-linecap': 'round' });
  const pCoast = svgEl('path', { fill: 'none', stroke: rgba(PAL.ink, 0.34), 'stroke-width': 1.1, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' });
  // 미탐색 너울. ⚠ 0.52 → **0.38** (2026-09-12 저녁) — 향 영역 **아래**로 내려갔으므로 색을 안 먹는다
  const rFog = svgEl('rect', { fill: PAL.ink, 'fill-opacity': 0.38, mask: 'url(#pbc-fog)' });
  // 갈 수 있는 바다의 **끝선** — `scentmap.navLoops()` 의 부드러운 고리 (2026-09-18 · 면과 같은 경로).
  //   ⚠ `non-scaling-stroke` — 확대해도 화면에서 같은 굵기다 (배율로 나눌 일이 없다)
  //   ⚠⚠ **밝은 선이다.** v0.48.0 의 먹색 끝선은 바깥이 *종이*였을 때의 값이다 — 바깥이 `--pb-void` 로
  //     다시 어두워졌으므로 또 뒤집힌다 (불변식 14 의 규율 · 미니맵의 IVORY 85% 와 같은 값이 됐다)
  const pNavEdge = svgEl('path', { fill: 'none', stroke: rgba(PAL.surface, 0.85), 'stroke-width': 1.4, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'vector-effect': 'non-scaling-stroke' });
  // ⚠⚠ **안개는 갈 수 있는 바다 안쪽에만 깐다** — 갈 수 없는 바다까지 '미탐색' 으로 덮는 것은 뜻이 없다.
  //   마스크 둘을 곱하는 방법이 이것이다 — 겹(`gIn`)에 '안쪽' 을 걸고 그 안의 판에 '안개' 를 건다
  // ⚠⚠⚠ **안개 너울이 향 영역 아래다** (2026-09-12 저녁, 화면 판정 두 번).
  //   위에 얹으면 향 영역의 색을 곱으로 눌러 아홉이 한 회색으로 뭉친다 — 그리고 채도를 빼는 것으로도
  //   못 살린다 : **부표 색은 일부러 등휘도다** (불변식 21 — 선형 휘도 0.33~0.45 로 맞춰 뒀다).
  const gIn = svgEl('g', { mask: 'url(#pbc-in)' });
  gIn.append(rSea, rFog, gTerr, gTerrLit, gTerrEdge, pCoast);
  // 쌓는 순서 : 갈 수 없는 바다(한 색) → 갈 수 있는 바다(물빛 · 너울 · 향 영역 · 해안선) → 끝선
  gSea.append(rVoid, gIn, pNavEdge);

  // 표시 층 — **화면 좌표**다 (배율과 무관한 크기여야 한다 : 점 · 글자 · 배)
  const gMark = svgEl('g');
  const pFoot = svgEl('polygon', { fill: rgba(PAL.shimmer, 0.16), stroke: rgba(PAL.shimmer, 0.55), 'stroke-width': 1.1 });
  const gPts = svgEl('g');
  const cHover = svgEl('circle', { r: 8, fill: 'none', stroke: PAL.accent, 'stroke-width': 1.4 });
  const gFams = svgEl('g');
  const gNames = svgEl('g');
  const pRoute = svgEl('path', { fill: 'none', stroke: rgba(PAL.accent, 0.85), 'stroke-width': 1.4, 'stroke-dasharray': '3 4' });
  const cRing = svgEl('circle', { r: 7, fill: 'none', stroke: rgba(PAL.accent, 0.9), 'stroke-width': 1.4 });
  const pBoat = svgEl('path', { fill: PAL.accent, stroke: rgba(PAL.surface, 0.95), 'stroke-width': 1.6 });
  gMark.append(pFoot, gPts, cHover, gFams, gNames, pRoute, cRing, pBoat);
  svg.append(defs, gSea, gMark);
  stage.appendChild(svg);

  // 글자 층의 글꼴은 판에서 물려받는다 (#stage 가 Noto Serif KR 이다 — 두 곳에 적지 않는다).
  // ⚠ 흰 테두리를 먼저 깔아 점·안개 위에서도 읽히게 한다 (`paint-order` — 미니맵의 strokeText 와 같은 뜻)
  for (const g of [gFams, gNames]) {
    g.setAttribute('text-anchor', 'middle');
    g.setAttribute('paint-order', 'stroke');
    g.setAttribute('stroke', rgba(PAL.surface, 0.92));
    g.setAttribute('stroke-linejoin', 'round');
  }

  // 이름 칸을 **미리 만들어 두고 돌려 쓴다** — 확대할 때마다 200개를 새로 만들지 않는다
  const namePool = [];
  const famPool = [];

  // ── 글자 폭 재기. ⚠ SVG 글꼴과 같은 문자열로 재야 겹침 판정이 맞는다 (ui.js LABEL_FONT 과 같은 규율)
  const meas = document.createElement('canvas').getContext('2d');
  let measFont = '', measCache = new Map();
  const textW = (t) => {
    let v = measCache.get(t);
    if (v === undefined) { meas.font = measFont; v = meas.measureText(t).width; measCache.set(t, v); }
    return v;
  };

  // ── 지나온 바다의 **벡터 윤곽** (2026-09-13, v0.50.0).
  //   안개 격자(미니맵이 주인 · 칸 4 월드)를 위 `traceGrid` 로 둥글린다.
  //   ⚠⚠ 예전에는 격자 크기 그대로의 그림을 마스크 안에서 늘리고 흐렸다 — 6배 확대에서 칸이 58px 이 되어
  //     흐린 계단으로 보였다 (사용자 화면). 경계는 벡터라야 확대해도 또렷하다.
  //   ⚠ 칸 수가 달라질 때만 다시 굽는다 (배가 새 칸을 밝혔을 때). 격자 1만 2천 칸이라 1ms 대다
  //   ⭐ 2026-09-18 : Chaikin 두 번 → **세 번**. 칸이 4 월드라 두 번으로는 격자 자국이 남았다
  //     (사용자 : *"흰색으로 영역이 띄어져있는것도 원형이 다 삐뚤고 어색하고"* — 이 윤곽이 곧 그 흰 자국이다)
  const fog = { key: '', loops: [], on: false };
  function buildFog() {
    const fm = fogGrid();
    if (!fm) { fog.key = 'off'; fog.loops = []; fog.on = false; fogN = -1; return; }
    fog.on = true;
    const key = fm.cols + 'x' + fm.rows + '@' + fm.n + '@' + fm.x0 + ',' + fm.z0;
    if (fog.key === key) return;
    fog.key = key; fogN = fm.n;
    const C = fm.cols, R = fm.rows, bits = fm.bits;
    const at = (i, j) => (i >= 0 && j >= 0 && i < C && j < R && bits[j * C + i] ? 1 : 0);
    const toXZ = (kk) => {
      const X = Math.floor(kk / 65536) - 4, Y = (kk % 65536) - 4;
      return [fm.x0 + (X / 2 + 0.5) * fm.cell, fm.z0 + (Y / 2 + 0.5) * fm.cell];
    };
    fog.loops = traceGrid(C, R, at, toXZ, 3);
  }


  // ── 배치. 판 크기가 바뀌거나 지도가 바뀔 때만 돈다
  function layout() {
    home = boundOn() ? map.navRect(margin() + MINI_BAND) : { ...map.bounds };
    const hw = home.x1 - home.x0, hh = home.z1 - home.z0;
    // ⚠⚠ **지도의 폭은 여기서 재서 넣는다.** 지도는 세로가 기준이라(1920×1080 에서 높이가 먼저 찬다)
    //   판을 화면 가득 두면 지도 양옆에 250px 씩 빈 띠가 남아 **버그처럼 보인다** (화면으로 확인).
    //   판은 `width:fit-content` 라 지도의 폭에 오그라들고, 남는 자리는 바다를 덮은 너울이 맡는다
    //   (종이 한 장이 어두운 바다 위에 뜬 그림이 된다).
    //   ⚠⚠ `aspect-ratio` 로는 안 된다 — 백분율 높이에서 나온 폭은 내재 폭이 아니라 `fit-content` 가 못 읽는다.
    //     첫 시안에서 **판 596px 안에 지도 1022px** 이 들어 범례가 판 밖으로 밀려났다 (화면으로 확인).
    //   ⚠ 그래서 순서가 있다 : 폭을 0 으로 두고 ① 쓸 수 있는 **높이**와 ② 지도를 뺀 판의 폭을 잰 뒤, 폭을 넣는다.
    //     판 높이는 CSS 가 정해 뒀으므로(calc) 폭이 높이에 되먹이지 않는다 — 순환이 아니다
    stage.style.aspectRatio = '';
    stage.style.width = '0px';
    const H0 = stage.getBoundingClientRect().height;
    // ⚠⚠ 남는 폭은 **여백 · 범례 · 사이 틈만** 세서 낸다. 지도를 뺀 **판 폭**을 재면 머리말의 최소 폭이
    //   섞여 든다 — 375px 창에서 머리말이 235px 을 우겨 지도가 **120px 사리**로 눌렸다 (실측).
    const pcs = panel ? getComputedStyle(panel) : null;
    const chrome = pcs ? parseFloat(pcs.paddingLeft) + parseFloat(pcs.paddingRight)
      + parseFloat(pcs.borderLeftWidth) + parseFloat(pcs.borderRightWidth) : 0;
    const legOn = legend && getComputedStyle(legend).display !== 'none';
    const legW = legOn ? legend.getBoundingClientRect().width + (parseFloat(getComputedStyle(stage.parentElement).columnGap) || 0) : 0;
    const maxW = (pcs && parseFloat(pcs.maxWidth)) || box.clientWidth;
    // 화면이 좁으면 폭이 기준이 된다 — 그때는 지도가 위아래로 남는다 (아래 s 가 알아서 작은 쪽을 고른다)
    const wantW = Math.max(120, Math.min(H0 * hw / hh, maxW - chrome - legW));
    stage.style.width = Math.round(wantW) + 'px';
    W = Math.round(wantW); H = Math.max(80, Math.round(H0));
    s = Math.min((W - PADS * 2) / hw, (H - PADS * 2) / hh);
    ox = (W - hw * s) / 2; oy = (H - hh * s) / 2;
    // 글자 크기는 반응형 변수에서 받는다 (불변식 23). 없으면 1920 에서 고른 기본값이다
    const cs = getComputedStyle(stage);
    nameFs = parseFloat(cs.getPropertyValue('--pb-chart-name')) || 11;
    famFs = Math.round(nameFs * 1.2);
    gNames.setAttribute('font-size', nameFs);
    gNames.setAttribute('font-weight', 400);
    gNames.setAttribute('stroke-width', 2.6);
    gFams.setAttribute('font-size', famFs);
    gFams.setAttribute('font-weight', 600);
    gFams.setAttribute('letter-spacing', (famFs * 0.12).toFixed(2));
    gFams.setAttribute('stroke-width', 3.4);
    const fam = (cs.fontFamily || 'serif');
    measFont = '400 ' + nameFs + 'px ' + fam;
    measCache = new Map();
    buildFog();
    clampPan();
    drawSea();
    drawPts();
  }

  // 지도 상자가 판 밖으로 달아나지 않게 (배율 1 이면 가운데로 돌아온다)
  function clampPan() {
    const hw = (home.x1 - home.x0) * s * k, hh = (home.z1 - home.z0) * s * k;
    tx = hw <= W ? (W - hw) / 2 - ox * k : Math.min(-ox * k, Math.max(W - hw - ox * k, tx));
    ty = hh <= H ? (H - hh) / 2 - oy * k : Math.min(-oy * k, Math.max(H - hh - oy * k, ty));
  }

  // ── 바다 층. 집 좌표계에 한 번 그리고, 확대·이동은 transform 이 받는다
  //   ⭐⭐ 2026-09-13 (v0.50.0) — **이 층에 비트맵이 없다.** 갈 수 있는 바다 = 원 200개의 합집합 경로,
  //   끝선 = 그 합집합의 정확한 바깥 호, 안개 = 마칭 스퀘어 윤곽. 확대해도 경계가 흐려지지 않는다
  function drawSea() {
    const bound = boundOn();
    // 판 전체를 덮는 사각형 — 확대·이동해도 판 밖이 드러나지 않게 세 배로 둔다
    //   (배율 1 이상에서 clampPan 이 지도 상자를 판에 붙여 두므로 보이는 곳은 늘 [0,W]×[0,H] 안이다)
    const BX = -W, BY = -H, BW = W * 3, BH = H * 3;
    for (const el of [rVoid, rSea, rFog, maskOutBg, maskFogBg, maskLitAll, maskIn, maskOut, maskFog, maskLit]) {
      el.setAttribute('x', BX); el.setAttribute('y', BY); el.setAttribute('width', BW); el.setAttribute('height', BH);
    }
    const hx = (x) => ox + (x - home.x0) * s, hy = (z) => oy + (z - home.z0) * s;
    // ⚠ 소수 둘째 자리까지 — 6배 확대에서 0.1px 반올림이 0.6px 어긋남이 되어 끝선과 면이 갈라진다
    const f = (v) => v.toFixed(2);
    if (bound) {
      // ── 갈 수 있는 바다 — **면과 끝선이 같은 경로다** (2026-09-18 · scentmap.navLoops 주석).
      //   ⚠ evenodd — 바다 속에 갈 수 없는 웅덩이가 생기면 구멍이 된다 (고리의 감김 방향과 무관하게)
      let d = '';
      for (const lp of map.navLoops()) {
        for (let i = 0; i < lp.length; i++) d += (i ? 'L' : 'M') + f(hx(lp[i][0])) + ' ' + f(hy(lp[i][1]));
        d += 'Z';
      }
      pInFill.setAttribute('d', d);
      pOutFill.setAttribute('d', d);
      pNavEdge.setAttribute('d', d);
      gIn.setAttribute('mask', 'url(#pbc-in)');
    } else {
      gIn.removeAttribute('mask');
    }
    rVoid.style.display = bound ? '' : 'none';
    pNavEdge.style.display = bound ? '' : 'none';
    // ── 안개 — 지나온 바다의 윤곽. evenodd 라 밝힌 바다 속의 안 밝힌 섬은 구멍이 된다
    let fd = '';
    if (fog.on) for (const lp of fog.loops) {
      for (let i = 0; i < lp.length; i++) fd += (i ? 'L' : 'M') + f(hx(lp[i][0])) + ' ' + f(hy(lp[i][1]));
      fd += 'Z';
    }
    pFogHole.setAttribute('d', fd);
    pLitFill.setAttribute('d', fd);
    rFog.style.display = fog.on ? '' : 'none';
    // ⚠ 안개가 꺼져 있으면 **어디나 지나온 곳**이다 — 색 겹이 판 전체에 얹힌다
    //   (v0.49.0 에서는 이 경우 마스크 그림이 비어 **색 겹이 통째로 사라졌다**)
    maskLitAll.style.display = fog.on ? 'none' : '';
    drawTerr();
    syncZoom();
  }

  // ── 향 영역 아홉 + 해안선. **집 좌표계에 한 번 굽는다** (확대는 바다 층 transform 이 받는다).
  //   ⚠ 정규화 → 월드는 `scentmap.toWorld()` 가 한다 — 변환식을 여기 또 적지 않는다 (불변식 21).
  //   ⚠ 색은 `areasNow()`(= CONFIG.families) 에서 받는다 — 점·부표와 같은 색이라야 향조가 이어진다.
  const terrPaths = [];

  // ── 마우스를 올린 향조 (범례). null 이면 아무것도 안 올렸다
  let famHover = null;
  /** 경계선 한 겹을 칠한다. 올렸으면 제 색으로 또렷하게, 아니면 아주 옅게 (gTerrEdge 주석) */
  function paintEdge(edge, on, amt) {
    edge.setAttribute('stroke-opacity', ((on ? 0.95 : 0.4) * amt).toFixed(3));
    edge.setAttribute('stroke-width', on ? 2.4 : 1);
  }
  /**
   * 범례에서 마우스가 오갈 때. **경계선만** 다시 칠한다 — 면 · 이름 · 점은 그대로다.
   * ⚠ 면을 같이 밝히지 않는다 : 아홉 색이 등휘도라(불변식 21) 한 영역만 밝히면 그 영역이 아니라
   *   **나머지가 어두워진 것**처럼 보인다. 경계 한 줄이 '어디까지가 이 해역인가' 를 더 잘 말한다.
   */
  function setFamHover(key) {
    if (famHover === key) return;
    famHover = key;
    const amt = terrAmt();
    for (const row of terrPaths) {
      if (row[2]) paintEdge(row[2], row[2].dataset.key === key, amt);
    }
  }

  function drawTerr() {
    const amt = terrAmt();
    const on = amt > 0.01 && map && typeof map.toWorld === 'function';
    // ⚠ **세 겹을 다 끈다** — 색 겹(gTerrLit)을 빼먹어 chartTerrain 0 에서 색만 남았다 (실측으로 걸렸다)
    for (const el of [gTerr, gTerrLit, gTerrEdge, pCoast]) el.style.display = on ? '' : 'none';
    if (!on) return;
    const fams = Object.fromEntries(areasNow().map((a) => [a.key, a]));
    const toH = (nx, ny) => { const w = map.toWorld(nx, ny); return [(ox + (w[0] - home.x0) * s).toFixed(1), (oy + (w[1] - home.z0) * s).toFixed(1)]; };
    const ringD = (r, close) => {
      let d = '';
      for (let i = 0; i < r.length; i += 2) { const c = toH(r[i], r[i + 1]); d += (i ? 'L' : 'M') + c[0] + ' ' + c[1]; }
      return d + (close ? 'Z' : '');
    };
    while (terrPaths.length < TERRAIN.families.length) {
      const a = svgEl('path'), b = svgEl('path');
      // 경계선 — 확대해도 화면에서 같은 굵기다 (끝선과 같은 규약)
      const c = svgEl('path', { 'vector-effect': 'non-scaling-stroke' });
      gTerr.appendChild(a); gTerrLit.appendChild(b); gTerrEdge.appendChild(c);
      terrPaths.push([a, b, c]);
    }
    TERRAIN.families.forEach((f, i) => {
      const [el, lit, edge] = terrPaths[i], fam = fams[f.key];
      const col = (fam && fam.color) || PAL.sage;
      const d = f.rings.map((r) => ringD(r, true)).join('');
      // 어디나 깔리는 겹 — 제 색의 34%. ⚠ 채도를 조금만 뺀다 (많이 빼면 등휘도라 아홉이 같아진다)
      el.setAttribute('fill', desat(col, 0.3));
      el.setAttribute('fill-opacity', (0.34 * amt).toFixed(3));
      el.setAttribute('d', d);
      // 지나온 곳에 **한 겹 더** — 제 색 그대로. 쌓이므로 탐색한 바다가 또렷하게 짙다
      lit.setAttribute('fill', col);
      lit.setAttribute('fill-opacity', (0.30 * amt).toFixed(3));
      lit.setAttribute('d', d);
      // 경계선 — 제 색. 평소엔 옅고, 마우스를 올린 하나만 또렷해진다 (gTerrEdge 주석 · setFamHover)
      edge.dataset.key = f.key;
      edge.setAttribute('stroke', col);
      edge.setAttribute('d', d);
      paintEdge(edge, f.key === famHover, amt);
    });
    pCoast.setAttribute('d', TERRAIN.coast.map((r) => ringD(r, false)).join(''));
    pCoast.setAttribute('stroke-opacity', (0.34 * amt).toFixed(3));
  }

  // 확대 · 이동을 한 줄로 먹인다. ⚠ 끝선은 `non-scaling-stroke` 라 배율을 따로 넘기지 않는다
  //   (v0.49.0 까지는 빗금 무늬를 배율로 나눠야 했다 — 무늬가 없어지면서 그 일도 없어졌다)
  function syncZoom() {
    gSea.setAttribute('transform', `translate(${tx.toFixed(2)} ${ty.toFixed(2)}) scale(${k.toFixed(4)})`);
    if (btnReset) btnReset.style.display = k > 1.01 ? 'block' : 'none';
  }

  // ── 향수 점 200개. 자리만 고쳐 쓴다 (만드는 것은 한 번)
  function drawPts() {
    const pts = map.points;
    while (gPts.childNodes.length < pts.length) gPts.appendChild(svgEl('circle', { r: 2.6, stroke: rgba(PAL.surface, 0.55), 'stroke-width': 1.1 }));
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i], c = gPts.childNodes[i];
      c.setAttribute('cx', sx(p.x).toFixed(1));
      c.setAttribute('cy', sy(p.z).toFixed(1));
      c.setAttribute('fill', p.fam.color);
    }
    drawNames();
  }

  // ── 이름. **순위가 높은 것부터 놓고 겹치면 건너뛴다** (marks.js 의 이름표와 같은 규율 : 우선이 낮은 쪽이 비킨다).
  //   ⚠ 화면 밖은 아예 후보가 아니다 — 확대하면 그만큼 자리가 나 이름이 더 펴진다 (그게 확대의 뜻이다)
  let byRank = [];
  function drawNames() {
    const boxes = [];
    const hit = (b) => boxes.some(o => o.x0 < b.x1 && o.x1 > b.x0 && o.y0 < b.y1 && o.y1 > b.y0);
    // ① 향조 아홉이 먼저다 — 해도에서 가장 큰 글자이고 향수 이름이 이것을 비켜 간다
    const fams = Object.entries(map.familyAnchors).map(([key, a]) => {
      const p = map.points.find(q => q.fam.key === key);
      return { key, name: p ? p.fam.name : key, a, fam: p && p.fam };
    });
    meas.font = '600 ' + famFs + 'px ' + (getComputedStyle(stage).fontFamily || 'serif');
    const famPut = [];
    for (const f of fams) {
      const w = meas.measureText(f.name).width + famFs * 0.12 * f.name.length;
      const hw2 = w * 0.5 + 3;
      const x = Math.min(W - hw2, Math.max(hw2, sx(f.a.x))), y = sy(f.a.z) - 9;
      const b = { x0: x - hw2, x1: x + hw2, y0: y - famFs, y1: y + 3 };
      boxes.push(b);
      famPut.push({ f, x, y });
    }
    while (famPool.length < famPut.length) { const t = svgEl('text'); gFams.appendChild(t); famPool.push(t); }
    famPool.forEach((t, i) => {
      const it = famPut[i];
      if (!it) { t.style.display = 'none'; return; }
      t.style.display = '';
      t.setAttribute('x', it.x.toFixed(1)); t.setAttribute('y', it.y.toFixed(1));
      t.setAttribute('fill', rgba(PAL.ink, 0.8));
      t.textContent = it.f.name;
      t.__fam = it.f; t.__x = it.x; t.__y = it.y;
    });
    // ② 향수 이름 — 순위 순서로 놓는다
    const put = [];
    const mode = nameMode();
    // ⭐ 1 이면 **지나온 바다만** 적는다 (사용자 : *"내가 탐색한 이름만 노출"*). 2 는 전부 (시연용)
    const fm = mode === 1 ? fogGrid() : null;
    if (mode >= 1) {
      if (!byRank.length || byRank.length !== map.points.length) byRank = [...map.points].sort((a, b) => (a.rank || 999) - (b.rank || 999));
      for (const p of byRank) {
        if (fm && !seen(fm, p.x, p.z)) continue;
        const x = sx(p.x), y = sy(p.z);
        if (x < -60 || x > W + 60 || y < -30 || y > H + 30) continue;
        const t = p.labelKo || p.nameKo || p.name;
        const hw2 = textW(t) * 0.5 + 4.5, top = y - 6 - nameFs - 1.5, bot = y - 6 + 4;   // ⚠ 여백을 좁히면 이름이 서로 닿아 한 덩어리로 읽힌다
        const b = { x0: x - hw2, x1: x + hw2, y0: top, y1: bot };
        if (hit(b)) continue;
        boxes.push(b);
        put.push({ p, x, y: y - 6, t });
        if (put.length >= NAME_CAP) break;
      }
    }
    while (namePool.length < put.length) { const t = svgEl('text'); gNames.appendChild(t); namePool.push(t); }
    namePool.forEach((t, i) => {
      const it = put[i];
      if (!it) { t.style.display = 'none'; return; }
      t.style.display = '';
      t.setAttribute('x', it.x.toFixed(1)); t.setAttribute('y', it.y.toFixed(1));
      t.setAttribute('fill', rgba(PAL.ink, 0.9));
      t.textContent = it.t;
    });
    named = new Set(put.map(o => o.p.i));
    famAt = famPut;
  }
  let named = new Set(), famAt = [];

  // ── 살아 있는 것들 (배 · 시야 · 가는 곳 · 호버). 값이 달라질 때만 고친다
  function drawLive() {
    const bx = sx(boat.x), by = sy(boat.z);
    if (foot && foot.length > 2) {
      pFoot.style.display = '';
      const kx = s * k, kz = s * k;
      pFoot.setAttribute('points', foot.map(p => (bx + p[0] * kx).toFixed(1) + ',' + (by + p[1] * kz).toFixed(1)).join(' '));
    } else pFoot.style.display = 'none';
    if (target) {
      const txp = sx(target.x), typ = sy(target.z);
      pRoute.style.display = ''; cRing.style.display = '';
      pRoute.setAttribute('d', `M${bx.toFixed(1)} ${by.toFixed(1)} L${txp.toFixed(1)} ${typ.toFixed(1)}`);
      cRing.setAttribute('cx', txp.toFixed(1)); cRing.setAttribute('cy', typ.toFixed(1));
    } else { pRoute.style.display = 'none'; cRing.style.display = 'none'; }
    // 배 — 뱃머리를 향한 삼각형. ⚠ 뱃머리의 월드 방향 (−sin h, −cos h) · 화면은 z 가 아래라 같은 부호 (미니맵과 같다)
    const fx = -Math.sin(boat.head), fy = -Math.cos(boat.head), r = 8, w = 5;
    pBoat.setAttribute('d', `M${(bx + fx * r).toFixed(1)} ${(by + fy * r).toFixed(1)}`
      + ` L${(bx - fx * r * 0.6 - fy * w).toFixed(1)} ${(by - fy * r * 0.6 + fx * w).toFixed(1)}`
      + ` L${(bx - fx * r * 0.6 + fy * w).toFixed(1)} ${(by - fy * r * 0.6 - fx * w).toFixed(1)} Z`);
    if (hoverPt) {
      cHover.style.display = '';
      cHover.setAttribute('cx', sx(hoverPt.x).toFixed(1)); cHover.setAttribute('cy', sy(hoverPt.z).toFixed(1));
    } else cHover.style.display = 'none';
  }

  // ── 머리말 오른쪽 글. 호버가 없으면 지도 전체를 말한다
  function idleHint() {
    if (!hintEl || !map) return;
    const fm = minimap && minimap.fogMask && minimap.fogMask();
    const ex = fm ? ' · 탐색 ' + Math.round(100 * fm.n / Math.max(1, fm.bits.length)) + '%' : '';
    hintEl.textContent = '향수 ' + map.points.length + ex + (k > 1.01 ? ' · ' + k.toFixed(1) + '배' : '');
  }

  // ── 범례 아홉. 누르면 그 향조의 대표 향수 자리로 떠난다 (미니맵에서 해역 이름을 누른 것과 같은 뜻)
  function drawLegend() {
    if (!legend) return;
    legend.innerHTML = '';
    const head = document.createElement('div');
    head.style.cssText = 'flex:none;padding-bottom:9px;margin-bottom:6px;border-bottom:1px solid ' + PAL.line
      + ';font-size:10px;font-weight:600;letter-spacing:0.2em;color:' + rgba(PAL.ink, 0.62);
    head.textContent = 'FAMILIES';
    legend.appendChild(head);
    // ⚠⚠ **순서와 번호는 `areas.js` 에서 받는다** (= CONFIG.families 의 배열 순서). 지도 데이터의
    //   `familyAnchors` 키 순서로 매기면 **존 정보 블록과 번호가 갈라진다** — 실측 : 해도는 '09 AMBER',
    //   정보 블록은 '07 AMBER ZONE' 이었다. ui.js 도 같은 배열의 findIndex 로 번호를 낸다 (불변식 2 · 21)
    //   ⚠ 번호는 **거른 뒤의 순서가 아니라** 원래 배열의 자리다 — 향수가 없는 향조가 생기면 갈라진다
    const list = areasNow().map((a, n) => ({ key: a.key, no: n + 1 })).filter(o => map.familyAnchors[o.key]);
    list.forEach(({ key, no }) => {
      const pts = map.points.filter(p => p.fam.key === key);
      if (!pts.length) return;
      const fam = pts[0].fam;
      const row = document.createElement('button');
      row.style.cssText = 'display:flex;align-items:center;gap:9px;width:100%;padding:7px 6px;border:none;border-radius:6px;'
        + 'background:none;font-family:inherit;text-align:left;cursor:pointer;color:' + PAL.ink + ';';
      row.innerHTML = '<span style="flex:none;width:15px;font-size:9.5px;letter-spacing:0.06em;color:' + rgba(PAL.ink, 0.45) + ';">'
        + String(no).padStart(2, '0') + '</span>'
        + '<span style="flex:none;width:9px;height:9px;border-radius:50%;background:' + fam.color + ';"></span>'
        + '<span style="flex:1;min-width:0;"><span style="display:block;font-size:11px;font-weight:600;letter-spacing:0.16em;">'
        + fam.name + '</span><span style="display:block;margin-top:1px;font-size:10.5px;color:' + rgba(PAL.ink, 0.55) + ';">'
        + ((fam.kw && fam.kw[0]) || '') + '</span></span>'
        + '<span style="flex:none;font-size:10px;color:' + rgba(PAL.ink, 0.45) + ';">' + pts.length + '</span>';
      // ⭐ 2026-09-18 : 지도에서 **그 해역의 경계선이 밝아진다** (setFamHover — 사용자 요청)
      row.onmouseenter = () => { row.style.background = rgba(PAL.surface2, 0.9); if (hintEl) hintEl.textContent = fam.name + ' 해역 · 향수 ' + pts.length; setFamHover(key); };
      row.onmouseleave = () => { row.style.background = 'none'; idleHint(); setFamHover(null); };
      row.onclick = () => {
        const a = map.familyAnchors[key];
        pick({ key, name: fam.name, x: a.x, z: a.z, custom: true });
      };
      legend.appendChild(row);
    });
    const tail = document.createElement('div');
    tail.style.cssText = 'flex:none;margin-top:auto;padding-top:10px;font-size:10px;line-height:1.7;color:' + rgba(PAL.ink, 0.45);
    tail.textContent = '해역을 누르면 그리로 떠납니다\n휠 확대 · 끌어 이동 · ESC 닫기';
    tail.style.whiteSpace = 'pre-line';
    legend.appendChild(tail);
  }

  // ── 맞히기. 화면 px → 월드 → (향수 · 향조 이름 · 빈 바다 · 범위 밖)
  function hitAt(e) {
    const r = stage.getBoundingClientRect();
    const px = e.clientX - r.left, py = e.clientY - r.top;
    const [x, z] = toW(px, py);
    // ⚠ 2026-09-13 : 여유(mapMargin) 없이 **그린 경계 그대로** 판정한다. 바깥을 한 색으로 칠하자 그 안쪽 20 월드를
    //   누르면 떠나는 것이 '갈 수 없는 바다를 눌렀는데 간다' 로 읽혔다 — 그림과 판정이 같아야 한다
    const out = boundOn() && !map.inNav(x, z, 0);
    // 향조 이름이 먼저다 (해역을 고르는 것이 해도의 뜻이다) — 그 다음이 향수 점
    let label = null, bd = LABEL_R;
    for (const it of famAt) { const d = Math.hypot(px - it.x, py - (it.y - famFs * 0.4)); if (d < bd) { bd = d; label = it; } }
    let pt = null, pd = SNAP;
    if (!label) for (const p of map.points) { const d = Math.hypot(px - sx(p.x), py - sy(p.z)); if (d < pd) { pd = d; pt = p; } }
    const reg = out ? null : map.regionAt(x, z);
    return { px, py, x, z, out, label: out ? null : label, pt: out ? null : pt, reg };
  }

  function pick(t) { close(); onPick && onPick(t); }

  // ── 누르기 · 끌기 · 휠
  const drag = { on: false, id: null, px: 0, py: 0, moved: 0 };
  const onDown = (e) => {
    if (e.button !== 0) return;
    drag.on = true; drag.id = e.pointerId; drag.px = e.clientX; drag.py = e.clientY; drag.moved = 0;
    stage.setPointerCapture && stage.setPointerCapture(e.pointerId);
  };
  const onMove = (e) => {
    if (!map) return;
    if (drag.on && e.pointerId === drag.id) {
      const dx = e.clientX - drag.px, dy = e.clientY - drag.py;
      drag.px = e.clientX; drag.py = e.clientY;
      drag.moved += Math.abs(dx) + Math.abs(dy);
      if (k > 1.01) {
        tx += dx; ty += dy; clampPan();
        syncZoom(); drawPts(); drawLive();
        stage.style.cursor = 'grabbing';
        return;
      }
    }
    const h = hitAt(e);
    hoverPt = h.pt;
    if (hintEl) {
      hintEl.textContent = h.out ? '범위 없음'
        : h.label ? h.label.f.name + ' 해역'
        : h.pt ? ((h.pt.labelKo || h.pt.nameKo || h.pt.name) + ' · ' + h.pt.fam.name
            + (seen(fogGrid(), h.pt.x, h.pt.z) ? '' : ' · 미탐색'))
        : h.reg ? h.reg.name + ' 해역' : '—';
    }
    stage.style.cursor = h.out ? 'not-allowed' : (h.label || h.pt) ? 'pointer' : 'crosshair';
    drawLive();
  };
  const onUp = (e) => {
    const wasDrag = drag.on && drag.moved > 5;
    if (drag.on && e.pointerId === drag.id) {
      drag.on = false;
      stage.releasePointerCapture && stage.hasPointerCapture && stage.hasPointerCapture(e.pointerId) && stage.releasePointerCapture(e.pointerId);
      stage.style.cursor = 'crosshair';
    }
    if (wasDrag || !map) return;
    const h = hitAt(e);
    if (h.out) { onBlocked && onBlocked(); return; }
    if (h.label) { const a = h.label.f.a; pick({ key: h.label.f.key, name: h.label.f.name, x: a.x, z: a.z, custom: true }); return; }
    if (h.pt) { pick({ key: h.pt.fam.key, name: h.pt.fam.name, x: h.pt.x, z: h.pt.z, custom: true, spot: true }); return; }
    if (h.reg) pick({ key: h.reg.key, name: h.reg.name, x: h.x, z: h.z, custom: true, spot: true });
  };
  const onLeave = () => { hoverPt = null; idleHint(); drawLive(); };
  // 휠 — 커서 아래 바다가 제자리에 있도록 배율을 바꾼다
  const onWheel = (e) => {
    e.preventDefault();
    const r = stage.getBoundingClientRect();
    const px = e.clientX - r.left, py = e.clientY - r.top;
    const k0 = k;
    k = Math.min(K_MAX, Math.max(1, k * Math.exp(-e.deltaY * 0.0016)));
    if (k === k0) return;
    tx = px - (px - tx) * (k / k0); ty = py - (py - ty) * (k / k0);
    clampPan(); syncZoom(); drawPts(); drawLive(); idleHint();
  };

  function resetZoom() { k = 1; clampPan(); syncZoom(); drawPts(); drawLive(); idleHint(); }

  // ── 열기 · 닫기
  function openIt() {
    if (open || !map) return;
    open = true;
    box.style.display = 'flex';   // ⚠ flex 다 — 판을 가운데 놓는다 (index.html 의 align/justify 가 여기서 산다)
    k = 1; tx = 0; ty = 0;
    mapKey = '';
    ensure();
    idleHint();
  }
  function close() {
    if (!open) return;
    open = false;
    box.style.display = 'none';
    hoverPt = null;
    drag.on = false;
    // ⚠ 닫을 때 경계선 강조를 거둔다 — 범례를 지우며 onmouseleave 가 안 오는 길이 있다 (다시 열면 켜진 채다)
    setFamHover(null);
  }
  // 지도가 바뀌었거나 처음 열었으면 다시 배치한다
  function ensure() {
    const key = map.size + '|' + map.minGap + '|' + map.flipY + '|' + (boundOn() ? margin() + '@' + map.navReach : 'x') + '|' + Math.round(stage.clientWidth) + 'x' + Math.round(stage.clientHeight);
    if (key === mapKey) return false;
    mapKey = key;
    layout(); drawLegend(); drawLive();
    return true;
  }

  // ⚠ 방향키가 **조타로 새지 않게** 가둔다 (input.js 는 window 에 붙어 있다). 캡처에서 잡아야 먼저 온다.
  //   ESC 도 여기서 먹는다 — 안 그러면 main.js 의 onKeyExit 이 존까지 같이 나간다
  const onKey = (e) => {
    if (!open) return;
    if (e.key === 'Escape') { e.stopPropagation(); e.preventDefault(); close(); return; }
    if (e.key.startsWith('Arrow') || e.key === 'Shift') { e.stopPropagation(); }
  };
  window.addEventListener('keydown', onKey, true);
  window.addEventListener('keyup', onKey, true);
  const onResize = () => { if (open) { mapKey = ''; ensure(); drawLive(); } };
  window.addEventListener('resize', onResize);
  stage.addEventListener('pointerdown', onDown);
  stage.addEventListener('pointermove', onMove);
  stage.addEventListener('pointerup', onUp);
  stage.addEventListener('pointerleave', onLeave);
  stage.addEventListener('wheel', onWheel, { passive: false });
  if (btnOpen) btnOpen.addEventListener('click', openIt);
  if (btnClose) btnClose.addEventListener('click', close);
  if (btnReset) btnReset.addEventListener('click', resetZoom);
  if (veil) veil.addEventListener('click', close);

  return {
    // main.js 의 tick 에서 미니맵과 **같은 값**을 받는다. ⚠ 닫혀 있으면 값만 갈아 두고 그리지 않는다
    update({ map: m, boat: b, target: t, foot: f }) {
      if (m && m !== map) { map = m; mapKey = ''; }
      boat = b || boat; target = t || null; foot = f || null;
      if (btnOpen) btnOpen.style.display = m ? 'flex' : 'none';
      if (!open || !map) return;
      if (ensure()) { drawLive(); return; }
      // 안개는 배가 지나가며 자란다 — 칸 수가 달라졌을 때만 그림을 다시 만든다
      const fm = minimap && minimap.fogMask && minimap.fogMask();
      // ⚠ 이름이 안개를 타므로 **이름도 같이** 다시 앉는다 (안개만 고치면 새로 밝힌 곳에 이름이 안 뜬다)
      if (fm && fm.n !== fogN) { buildFog(); drawSea(); drawNames(); idleHint(); }
      const key = [Math.round(b.x * 4), Math.round(b.z * 4), Math.round(b.head * 40),
        t ? Math.round(t.x) + ',' + Math.round(t.z) : '-', f ? f.length : 0].join('|');
      if (key === lastLive) return;
      lastLive = key;
      drawLive();
    },
    open: openIt,
    close,
    isOpen: () => open,
    report() {
      if (!map) return '해도 — 지도 없음';
      const fm = fogGrid();
      return `해도 ${open ? '열림' : '닫힘'} · ${W}×${H} · 배율 ${k.toFixed(2)} · 이름 ${named.size}/${map.points.length}`
        + ` (모드 ${nameMode()}${fm ? ' · 밝힌 칸 ' + fm.n : ' · 안개 꺼짐'})`
        + ` · 향 영역 ${TERRAIN.families.length}개 고리 ${TERRAIN.families.reduce((a, f) => a + f.rings.length, 0)} · 해안선 ${TERRAIN.coast.length}`
        + ` · 바다 고리 ${map.navLoops ? map.navLoops().length : 0} · 안개 윤곽 ${fog.loops.length}고리 (${fog.key})`;
    },
    dispose() {
      window.removeEventListener('keydown', onKey, true);
      window.removeEventListener('keyup', onKey, true);
      window.removeEventListener('resize', onResize);
      stage.removeEventListener('pointerdown', onDown);
      stage.removeEventListener('pointermove', onMove);
      stage.removeEventListener('pointerup', onUp);
      stage.removeEventListener('pointerleave', onLeave);
      stage.removeEventListener('wheel', onWheel);
      if (btnOpen) btnOpen.removeEventListener('click', openIt);
      if (btnClose) btnClose.removeEventListener('click', close);
      if (btnReset) btnReset.removeEventListener('click', resetZoom);
      if (veil) veil.removeEventListener('click', close);
      box.style.display = 'none';
      stage.innerHTML = '';
      if (legend) legend.innerHTML = '';
      open = false;
    }
  };
}
