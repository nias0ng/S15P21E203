import * as THREE from 'three';
import { LineSegments2 } from 'three/examples/jsm/lines/LineSegments2.js';
import { LineSegmentsGeometry } from 'three/examples/jsm/lines/LineSegmentsGeometry.js';
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js';
import { CONFIG } from './config.js';
import { PARAMS as P } from './params.js';
import { timeNow } from './times.js';

// ───────── 유사 향수 연결선 (2026-09-12 오후, params.focusLinks) ─────────
// 사용자 : *"제일 유사한 향수끼리 3개 4개를 연결하는 선이 이어졌으면 좋겠음"*.
//
// ⭐⭐ **유사도는 데이터의 neighbors 다** (2026-09-14, v0.62.0 — `focusLinkBasis` 1). 사용자 확정 : *"백엔드에 있는 자료가 더 좋을듯"*.
//   향수마다 어코드·노트 유사도로 뽑은 닮은 향수 10개(`perfumes-data.js` 의 `nb` ← data/scent_map.json)이고,
//   백엔드 `perfume_neighbors`(/api/v1/perfumes/{id}/neighbors · /similar)와 **같은 목록**이다 — 선과 서비스의 '닮은 향수' 가 갈라지지 않는다.
//   ⚠⚠ 예전(v0.39.0 ~ v0.61.0, `focusLinkBasis` 0)에는 *"향 지도 좌표가 곧 유사도다"* 로 mx·my 거리를 썼다. 그런데 원본이
//     *"x,y 로 거리를 계산하면 안 된다"* 고 적어 두었고(좌표는 200개를 평면에 눌러 담은 것), 지도 거리 가까운 10개와
//     neighbors 는 평균 **43.1%** 만 겹친다 (데이터의 knn_overlap_at_10 0.431 과 같은 수 · 불변식 29-3).
//   ⚠ 12개를 **고르는 것**은 그대로 배에서 가까운 순(월드 거리)이다 — 지도 거리는 '배 주변 바다' 라는 공간에만 쓴다 (marks.js focusOn).
//   ⚠ 거리 기준(0)에서도 월드 좌표(m.x/m.z)가 아니라 원본 mx·my 로 잰다 — mapSize 배율 · 겹침 풀기(mapMinGap)가 섞이지 않게.
//
// **무엇을 잇는가** — 향수 고르기로 떠오른 12개 **안에서만** 잇는다. 항해 중 200개를 이으면
// 바다가 그물이 되고, 지도 반대편까지 선이 가로지른다.
//   · 모드 0 (기본) : 가장 닮은 변부터 이어 붙이되 **무리 하나가 focusLinkMax 명을 넘지 않게** 막는다
//     (Kruskal + 크기 상한). 그래서 3~4개짜리 무리 여럿이 생기고, 무리끼리는 안 이어진다.
//   · 모드 1 : **누른 향수**에서 가장 비슷한 focusLinkMax 개로 뻗는다 (별 모양).
//
// ⚠ 굵기는 **화면 px** 다 (LineMaterial, worldUnits 기본값 false). 월드 굵기로 두면 먼 것이 실처럼 사라진다.
//   그래서 `resolution` 을 창 크기로 계속 맞춰 줘야 한다 (onResize).
// ⚠ 선은 부표 **표면**에서 시작한다 (반지름만큼 줄인다) — 중심까지 그으면 빛나는 공을 꿰뚫는다
//   (몸통이 transparent 라 깊이를 안 써서 선이 공 위에 그려진다).
// ⚠ 진하기는 양 끝 부표의 보임(fade)을 곱한다 — 12개가 솟는 동안 선도 같이 나타나고, 가라앉으면 같이 사라진다.
//   경계에 값이 남지 않는다 (불변식 19).
// ⭐ **하나씩 뻗는다** (2026-09-12, 사용자 : *"하나씩 연결되는 빠른 모션이라던지"*).
//   변마다 시차를 두고 **A 에서 B 로 자란다** — 끝점을 보간할 뿐이라 선분 수도 드로우콜도 안 는다.
//   ⚠⚠ **유사한 변부터 간다.** Kruskal 이 가장 닮은 짝부터 집으므로 `edges` 가 이미 차이 오름차순이다 —
//     그래서 화면에서 *"가장 비슷한 것부터 이어진다"* 가 공짜로 따라온다 (정렬을 따로 안 한다).
//   ⚠ 시계는 **실시간 dt** 다. 물 현상이 아니라 **누른 것에 대한 반응**이라 불변식 1 의 예외다
//     (phase.js 도 같은 이유). 목록이 바뀌면 0 으로 돌아가 다시 그어진다.
// ⭐ **선이 양 끝 부표의 색으로 물든다** (2026-09-12, `focusLinkTint`. 사용자 : *"선 마다 해당 연결된
//   오브젝트 색상과 은은하게 그라데이션이 들어갔으면"*). A 끝에 A 의 몸통 색, B 끝에 B 의 몸통 색을
//   넣으면 **보간이 그라데이션을 공짜로 만든다** — `LineMaterial` 이 `instanceColorStart/End` 를
//   프래그먼트까지 보간하기 때문이다. 선분을 쪼개지 않으므로 드로우콜도 정점도 안 는다.
//   ⚠ 색은 `marks.linkItems()` 가 주는 **색 참조**다. 여기서 새로 계산하지 않는다 —
//     `paint()` 가 정한 그 색이라야 선과 부표가 갈라질 수 없다 (불변식 2).
//   ⚠⚠ 2026-09-12 저녁 : 그 색이 **발광색(`m.base`)** 으로 바뀌었다 (`focusLinkSrc`). 몸통색은 향조 색에
//     알베도 0.22 를 곱한 값이라 CITRUS 가 #615932 로 나갔고, 아홉 향조가 회갈색으로 뭉쳐 구분이 안 됐다.
//     화면에서 부표로 보이는 것은 발광 쌍둥이의 색이므로 이쪽이 불변식 2 를 **더 잘** 지킨다.
//   ⚠ 보간은 **굵기와 무관하다** (실측 : 빨강 끝 248,0,72 → 가운데 187,0,188 → 파랑 끝 70,0,248).
//     굵기가 정하는 것은 그 색이 차지하는 **면적**이다.
//   ⚠⚠ 2026-09-12 저녁 **1920×1080 화면에서 쟀다** — 2.4px 은 실처럼 얇았다. 사용자 : *"마치 광선처럼"*
//     → 3.6px · 진하기 0.85 · 발광색. ⚠ 굵기가 CSS px 이라 **창이 넓을수록 상대적으로 얇다** —
//     값을 고칠 때는 반드시 1920 에서 본다 (CLAUDE.md '테스트 창은 1920×1080').
// ⭐ **유사도를 진하기로 보여 준다** (`focusLinkSim`). 닮은 짝일수록 진하고 덜 닮은 짝은 옅다 (차이 d 의 목록 안 상대값).
//   ⚠⚠ 굵기로는 못 한다 — `LineMaterial` 의 굵기는 **재질 하나**라 선분마다 다르게 못 준다.
//     그래서 **정점 색**(vertexColors)으로 낸다. 색을 바탕 쪽으로 섞어 옅게 만든다.
//   ⚠ 그래서 '선이 있다/없다' 만이 아니라 **얼마나 비슷한가**가 화면에 남는다 — 선의 의미가 하나 는다.
// ⚠ 색은 시간대 표에서 받는다 (불변식 25) — 낮에는 먹선, 저녁·밤에는 글자와 같은 밝은 색.
// ⚠ 반사 패스(레이어 2)에 넣지 않는다 (`noReflect`) — 물에 비친 선까지 겹치면 그물이 하나 더 생긴다.
// ⭐⭐ **선이 광선처럼 보인다 — 그런데 번짐(가산)이 아니라 후광(짙기)이다** (`focusLinkGlow`).
//   사용자 : *"마치 광선처럼 연결되게끔"* → 처음엔 부표처럼 **레이어 3(GlowPass)** 에 태웠다. **그게 틀렸다.**
//   ⚠⚠⚠ **흰 종이 위에서는 더하기로 빛을 못 만든다.** 바탕이 0.96 이라 헤드룸이 **0.04** 뿐이다.
//     `bloom.js` 의 `HALO_FRAG` 는 번짐을 더한 뒤 1 을 넘으면 `c / cm` 으로 **전체를 같은 비로** 누르는데,
//     흰 바탕에서는 그 나눗셈이 **배경보다 어둡게** 만든다 — 노란 선(#d4be2c) 둘레에서 파랑이
//     **−9 ~ −63** 떨어졌다 (계산 실측 2026-09-12 저녁). 사용자 : *"미세하게 검은색 띠가 보임"*.
//     동시에 빨강은 255 로 포화되어 *"색상이 줄마다 너무 심하게 흰색까지 가는"* 것도 같은 수식에서 나온다.
//   ⭐ 그래서 후광을 **본 화면(레이어 0)** 에 그린다 — 굵고 옅은 선을 본선 **아래** 깔 뿐이다.
//     normal blending 이라 흰 바탕에서 **짙어지고**, 포화도 정규화도 없다. 사용자 : *"차라리 짙어지는 표현"*.
//   ⚠ 지오메트리를 **공유**한다 — 위치 · 색 · instanceCount 가 자동으로 따라와서 갱신할 곳이 한 군데다.
//     따로 가는 것은 굵기와 진하기뿐이다.

const MAX = 32;   // 최대 선분 수 (focusCount 24 → 변 23 개)

// ⭐⭐ 유사도의 기준 (2026-09-14, v0.62.0 — `focusLinkBasis`). 1 = 데이터 neighbors (기본) · 0 = 향 지도 좌표 거리 (예전)
export const linkBasis = () => ((P.focusLinkBasis === undefined ? 1 : P.focusLinkBasis) >= 0.5 ? 1 : 0);

// 두 향수의 닮은 정도 (0~1). 서로의 목록에 없으면 −1 — **모른다**는 뜻이다 (닮지 않았다는 값이 아니다).
// items 의 `nb` = [[fragrantica_id, 유사도], …] 닮은 순 10개 (perfumes-data.js — data/scent_map.json 의 neighbors).
// ⚠ 방향이 있다 — a 의 10개에 b 가 있어도 b 의 10개에 a 가 없을 수 있다 (2000행 중 810행이 한쪽뿐). **어느 쪽 목록에 있든** 짝으로 본다
export function linkSim(a, b) {
  let s = -1;
  if (a && a.nb) for (const e of a.nb) if (e[0] === b.id) { s = e[1]; break; }
  if (b && b.nb) for (const e of b.nb) if (e[0] === a.id) { if (e[1] > s) s = e[1]; break; }
  return s;
}

// 두 향수의 **차이** (거리꼴 — 제곱이 아니다). 선의 진하기와 깊이 배치(main.js focusDepthPlace)가 같은 눈금으로 읽는다 (불변식 2).
//   neighbors : 1 − 유사도. 서로의 목록에 없으면 **목록 끝보다 덜 닮은 것**으로 본다 — 두 목록의 가장 낮은 유사도로 잰다
//   지도 거리 : 원본 mx·my 의 거리 (예전 그대로 — 값 단위로 같다)
export function linkDiff(a, b, basis = linkBasis()) {
  if (!basis) return Math.hypot(a.mx - b.mx, a.my - b.my);
  const s = linkSim(a, b);
  if (s > 0) return 1 - s;
  const tail = (q) => (q && q.nb && q.nb.length ? q.nb[q.nb.length - 1][1] : 0);
  return 1 - Math.min(tail(a), tail(b));
}

// ⭐ 12개 안에서 **어느 짝을 잇는가** — 이 식 하나를 선(아래 createLinks)과 깊이 배치(main.js)가 같이 쓴다 (2026-09-13).
// 가장 닮은 변부터 이어 붙인다 (Kruskal). ⚠ 무리 **크기 상한**이 이 함수의 전부다 —
//   상한이 없으면 12개가 한 줄로 전부 이어져(최소 신장 트리) '무리' 가 안 보인다
// items = [{ id, nb, mx, my, clicked }] · 반환 = [[i, j, d], …] 차이 오름차순 (= 닮은 순). ⚠ d 는 **제곱**이다 (linkDiff 의 제곱)
// ⭐⭐ 2026-09-14 (v0.62.0) : 짝의 후보가 기준마다 다르다.
//   neighbors (1) : **서로의 목록에 있는 짝만** 후보다 — 200개 중 닮은 10개에 든 것 자체가 문턱이라 `focusLinkCut` 을 안 쓴다.
//     실측 (엔진 코드 그대로 · 무리 상한 4) : 12개 안 후보 짝이 평균 약 30개라 선 수가 거리 기준과 거의 같다
//     (무작위 바다 2000곳 8.06 → 7.94 · 배가 누른 향수 자리 200가지 7.98 → 7.96). 달라지는 것은 **어느 짝**이냐 — 같은 선 평균 2.2~2.5개.
//   지도 거리 (0) : 모든 짝이 후보이고 **중앙값 × focusLinkCut** 보다 먼 짝을 버린다 (예전 그대로)
export function linkEdges(items, mode, maxN, max = Infinity, basis = linkBasis()) {
  const n = items.length, pairs = [];
  let cut = Infinity;
  if (basis) {
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const s = linkSim(items[i], items[j]);
        if (s > 0) pairs.push({ i, j, d: (1 - s) * (1 - s) });
      }
    }
    pairs.sort((a, b) => a.d - b.d);
  } else {
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const dx = items[i].mx - items[j].mx, dy = items[i].my - items[j].my;
        pairs.push({ i, j, d: dx * dx + dy * dy });
      }
    }
    pairs.sort((a, b) => a.d - b.d);
    // ⚠⚠ **안 비슷하면 안 잇는다.** 무리를 채우려다 남은 둘을 이으면 '제일 유사한 향수끼리' 가 깨진다 —
    //   실측 (12개, 첫 시안) : 변 아홉 중 둘이 전체 짝 거리의 중앙값보다 멀었다 (0.112 · 0.224 대 중앙값 0.127).
    //   그래서 **중앙값 × focusLinkCut** 보다 먼 짝은 버린다. 혼자 남는 향수는 선이 없다 (그게 정보다)
    const med = pairs.length ? pairs[pairs.length >> 1].d : 0;
    cut = med * Math.max(0.05, P.focusLinkCut === undefined ? 1 : P.focusLinkCut);
  }
  if (mode >= 0.5) {
    // 별 — 누른 향수에서 가장 비슷한 maxN 개. ⚠ 누른 것이 12개에 없으면(가라앉는 중) 아무것도 안 긋는다
    const c = items.findIndex(q => q.clicked);
    if (c < 0) return [];
    return pairs.filter(p => (p.i === c || p.j === c) && p.d <= cut).slice(0, Math.max(1, maxN)).map(p => [p.i, p.j, p.d]);
  }
  const par = items.map((_, i) => i), size = items.map(() => 1), out = [];
  const find = (a) => { while (par[a] !== a) { par[a] = par[par[a]]; a = par[a]; } return a; };
  for (const p of pairs) {
    if (p.d > cut) break;                        // 정렬돼 있으므로 여기서 끝이다
    const a = find(p.i), b = find(p.j);
    if (a === b) continue;
    if (size[a] + size[b] > maxN) continue;      // 무리가 차면 건너뛴다 — 그 둘은 다른 무리로 남는다
    par[a] = b; size[b] += size[a];
    out.push([p.i, p.j, p.d]);   // ⚠ 차이(d)도 싣는다 — 진하기와 깊이 배치가 이걸 읽는다
    if (out.length >= max) break;
  }
  return out;
}

export function createLinks(scene) {
  const pos = new Float32Array(MAX * 6);
  const geo = new LineSegmentsGeometry();
  geo.setPositions(pos);            // ⚠ Float32Array 를 넘기면 **그 배열을 그대로** 쓴다 (복사하지 않는다) —
  const buf = geo.getAttribute('instanceStart').data;   //   그래서 아래에서 pos 를 직접 쓰고 needsUpdate 만 건다
  // ⚠ 색도 같은 규약이다 (setColors 도 배열을 그대로 참조한다). 선분마다 진하기를 달리 주는 유일한 길 —
  //   굵기는 재질 하나라 못 나눈다
  const colA = new Float32Array(MAX * 6);
  geo.setColors(colA);
  const cbuf = geo.getAttribute('instanceColorStart').data;
  const mat = new LineMaterial({
    color: 0xffffff, linewidth: 1.6, transparent: true, opacity: 0,
    vertexColors: true,             // ⚠ 색은 정점에서 온다 — mat.color 는 1 로 두고 곱해지게 한다
    depthTest: true, depthWrite: false, alphaToCoverage: false
  });
  mat.resolution.set(1, 1);
  const mesh = new LineSegments2(geo, mat);
  mesh.frustumCulled = false;       // 12개가 카메라 앞에 서 있고 경계구를 매 프레임 다시 재지 않는다
  mesh.renderOrder = 6;             // 물 위 · 부표와 같은 층
  mesh.userData.noReflect = true;
  mesh.visible = false;
  scene.add(mesh);

  // ⭐ 번짐 쌍둥이 (레이어 3). ⚠ `geo` 를 그대로 공유한다 — 아래 update 가 본선만 갱신하면 같이 따라온다
  const glowMat = new LineMaterial({
    color: 0xffffff, linewidth: 6, transparent: true, opacity: 0,
    vertexColors: true,             // 본선과 같은 정점 색 — 같은 향조 색이 둘레에 옅게 깔린다
    depthTest: true, depthWrite: false
  });
  glowMat.resolution.set(1, 1);
  const glowMesh = new LineSegments2(geo, glowMat);
  glowMesh.frustumCulled = false;
  glowMesh.renderOrder = 5;          // ⚠ 본선(6)보다 **먼저** — 굵은 옅은 선이 아래, 가는 진한 선이 위
  glowMesh.userData.noReflect = true;
  glowMesh.visible = false;
  scene.add(glowMesh);

  const col = new THREE.Color(), c2 = new THREE.Color();
  // ⭐⭐ **덜 비슷하면 색이 빠진다 — 바탕으로 옅어지지 않는다** (2026-09-12 저녁).
  //   v0.40.0 까지는 그 시간대의 **바탕색으로 섞어** 옅게 만들었다. 흰 종이에서 그러면 선이 **사라진다** —
  //   실측 : 가장 안 비슷한 짝이 #e3ddd5 로 바탕(#F6F5F2)과 거리 **38** 이었다.
  //   사용자 : *"흰색으로 보이는 경우를 줄이셈"*. 채도만 빼면 **명도가 남아 끝까지 보이고**,
  //   비슷한 짝은 향조 색이 선명해서 구분이 그대로 선다 (#d4be2c → 채도 0 이면 회색, 흰 종이에서 읽힌다).
  //   ⚠ 그래서 이 표현은 이제 시간대 바탕을 안 탄다 — 밤바다에서도 같은 규칙이다.
  // born[e] = 이 변의 양 끝이 **처음 둘 다 보인** 때의 age (−1 = 아직). 뻗기는 차례(e × step)와 이것 중 늦은 쪽에서 시작한다
  let edges = [], key = '', age = 0, born = [];
  const _hsl = { h: 0, s: 0, l: 0 };
  function desat(c, k) {
    if (k <= 0) return c;
    c.getHSL(_hsl);
    return c.setHSL(_hsl.h, _hsl.s * (1 - k), _hsl.l);
  }

  // ⚠ 변을 짜는 식은 모듈 위의 `linkEdges` **하나**다 — 12개의 깊이 배치(main.js focusDepthPlace)도 같은 식으로
  //   무리를 읽는다 (2026-09-13). 두 곳에 적으면 배치가 가정한 무리와 그려지는 선이 갈라진다 (불변식 2)
  const build = (items, mode, maxN) => linkEdges(items, mode, maxN, MAX);

  return {
    mesh,
    // items = marks.linkItems() (없으면 null). 매 프레임 부른다. dt 는 실시간 초 (뻗는 시계)
    update(items, dt = 0) {
      const on = (P.focusLinks === undefined ? 1 : P.focusLinks) >= 0.5;
      if (!on || !items || items.length < 2) { mesh.visible = glowMesh.visible = false; key = ''; age = 0; return; }
      const mode = P.focusLinkMode || 0;
      const maxN = Math.max(2, Math.round(P.focusLinkMax === undefined ? 4 : P.focusLinkMax));
      // 무리는 **목록이 바뀔 때만** 다시 짠다 — 매 프레임 짜면 솟는 동안 선이 갈아탄다
      // ⚠ 기준(focusLinkBasis)도 키에 넣는다 — 안 넣으면 스위치를 바꿔도 이미 짠 무리가 그대로 남는다 (v0.62.0)
      const k = items.map(q => q.id).join(',') + '|' + mode + '|' + maxN + '|' + linkBasis();
      // ⚠ 목록이 바뀌면 무리를 다시 짜고 **시계도 0 으로** 돌린다 — 새로 그어지는 것이 이 연출의 전부다
      if (k !== key) { key = k; edges = build(items, mode, maxN); age = 0; born = edges.map(() => -1); }
      age += dt;
      const grow = Math.max(0.01, P.focusLinkGrow === undefined ? 0.18 : P.focusLinkGrow);
      const step = Math.max(0, P.focusLinkStep === undefined ? 0.07 : P.focusLinkStep);
      const simK = Math.max(0, Math.min(1, P.focusLinkSim === undefined ? 0.55 : P.focusLinkSim));
      // 부표 색을 얼마나 쓰는가. 0 = 시간대 색 하나 (예전) · 1 = 몸통 색 그대로
      const tintK = Math.max(0, Math.min(1, P.focusLinkTint === undefined ? 0.7 : P.focusLinkTint));
      // 진하기의 기준 — 이 목록 안에서 가장 닮은 짝과 가장 덜 닮은 짝 (차이 d · 기준은 focusLinkBasis)
      let dLo = Infinity, dHi = 0;
      for (const e of edges) { const d = e[2] || 0; if (d < dLo) dLo = d; if (d > dHi) dHi = d; }
      const dSpan = dHi - dLo;
      // 색은 먼저 정한다 — 선분마다 이 색의 **채도를 빼서** 덜 비슷한 짝을 표시한다
      const T = timeNow();
      col.set(T && T.title && T.title.to ? T.title.to : (CONFIG.line && CONFIG.line.color) || '#555555');

      let n = 0, aMax = 0;
      for (let e = 0; e < edges.length; e++) {
        const [i, j, ed] = edges[e];
        const A = items[i], B = items[j];
        if (!A || !B) continue;
        // ⭐ 2026-09-13 — **양 끝이 떠오른 뒤에** 뻗는다. 12개가 시차를 두고 솟으므로 목록은 12개 전부이고(marks.linkItems),
        //   한쪽이 아직 물속이면 이 변은 건너뛴다. 처음 둘 다 보인 때를 적어 두고 거기서부터 뻗는다
        const vis = Math.min(A.a, B.a);
        if (vis < 0.02) continue;
        if (born[e] < 0) born[e] = age;
        let dx = B.x - A.x, dy = B.y - A.y, dz = B.z - A.z;
        const L = Math.hypot(dx, dy, dz);
        const r0 = (A.r || 0) * 1.15, r1 = (B.r || 0) * 1.15;
        const span = L - r0 - r1;
        if (!(span > 0.05)) continue;              // 붙어 있으면 안 긋는다 (줄이면 뒤집힌다)
        dx /= L; dy /= L; dz /= L;
        // ⭐ 하나씩 뻗는다. ⚠ 변 순서가 곧 유사도 순서다 (edges 가 차이 오름차순)
        //   outCubic — 빠르게 나가 부드럽게 멈춘다 (phase.js 의 윙과 같은 커브를 쓰는 이유 : §7)
        const u = (age - Math.max(e * step, born[e])) / grow;
        if (u <= 0) continue;                      // 아직 이 변의 차례가 아니다
        // ⭐ 나갈 때는 **가라앉는 쪽으로 감긴다** — 한쪽 부표가 옅어지는 만큼 선이 짧아진다 (뚝 사라지지 않는다)
        const g = Math.min(u >= 1 ? 1 : 1 - Math.pow(1 - u, 3), Math.min(1, vis / 0.6));
        const o = n * 6;
        pos[o] = A.x + dx * r0; pos[o + 1] = A.y + dy * r0; pos[o + 2] = A.z + dz * r0;
        pos[o + 3] = A.x + dx * (r0 + span * g);
        pos[o + 4] = A.y + dy * (r0 + span * g);
        pos[o + 5] = A.z + dz * (r0 + span * g);
        // ⭐ 유사도 → 진하기. w 1 = 이 목록에서 가장 비슷한 짝
        const w = dSpan > 1e-9 ? 1 - ((ed || 0) - dLo) / dSpan : 1;
        const fade = (1 - w) * simK;
        // ⭐ 양 끝에 **각자의** 부표 색 — 이 한 줄이 그라데이션의 전부다 (보간은 재질이 한다)
        c2.copy(col); if (A.col) c2.lerp(A.col, tintK); desat(c2, fade);
        colA[o] = c2.r; colA[o + 1] = c2.g; colA[o + 2] = c2.b;
        c2.copy(col); if (B.col) c2.lerp(B.col, tintK); desat(c2, fade);
        colA[o + 3] = c2.r; colA[o + 4] = c2.g; colA[o + 5] = c2.b;
        if (vis > aMax) aMax = vis;
        n++;
      }
      if (!n) { mesh.visible = glowMesh.visible = false; return; }
      buf.needsUpdate = true;
      cbuf.needsUpdate = true;
      geo.instanceCount = n;
      mat.color.setRGB(1, 1, 1);   // ⚠ 정점 색과 곱해진다 — 1 이라야 정점 색 그대로 나간다
      mat.linewidth = Math.max(0.2, P.focusLinkW === undefined ? 1.6 : P.focusLinkW);
      // ⚠ 진하기는 재질 **하나**다 — 평균을 쓰면 막 떠오르는 부표 하나가 **다른 선까지** 흐리게 만든다 (시차가 켜진 뒤).
      //   가장 또렷한 변을 따른다. 모두 함께 움직이던 예전에는 평균 = 최댓값이라 화면이 같다
      mat.opacity = Math.max(0, P.focusLinkA === undefined ? 0.5 : P.focusLinkA) * aMax;
      mesh.visible = mat.opacity > 0.004;
      // ⭐ 후광 — 색도 선분도 본선과 같다. 다른 것은 **굵기와 진하기**뿐이다.
      //   ⚠⚠ 색에 배수를 곱하지 않는다 (`mat.color` 는 흰색 그대로). 1 을 넘기면 흰 종이에서 포화되어
      //     향조 색이 날아간다 — 그게 레이어 3 을 버린 이유다 (머리말).
      //   ⚠ `focusLinkGlow` 0 이면 후광이 통째로 빠진다 (v0.39.2 까지의 동작 — 선 한 겹이었다)
      const gK = Math.max(0, P.focusLinkGlow === undefined ? 1 : P.focusLinkGlow);
      if (gK > 0.004) {
        glowMat.linewidth = mat.linewidth * Math.max(1, P.focusLinkGlowW === undefined ? 1.9 : P.focusLinkGlowW);
        // 둘레는 **옅게** 깔린다 — 본선 진하기의 gK 배 (기본 0.35). 겹쳐서 심이 짙어 보이는 것이 요점이다
        glowMat.opacity = mat.opacity * Math.min(1, gK);
      }
      glowMesh.visible = mesh.visible && gK > 0.004;
    },
    resize(w, h) {
      const W = Math.max(1, w), H = Math.max(1, h);
      mat.resolution.set(W, H); glowMat.resolution.set(W, H);   // ⚠ 쌍둥이도 같이 — 안 맞추면 번짐 굵기만 옛 창 기준이 된다
    },
    dispose() {
      scene.remove(mesh); scene.remove(glowMesh);
      geo.dispose();   // ⚠ 공유 지오메트리라 한 번만
      mat.dispose(); glowMat.dispose();
    }
  };
}
