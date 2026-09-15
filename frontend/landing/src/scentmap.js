import { CONFIG } from './config.js';
import { PERFUMES } from './perfumes-data.js';
// ⚠ `navReach` 하나를 읽는다. params.js 는 아무것도 import 하지 않으므로 순환이 없다
import { PARAMS as P } from './params.js';
// ⚠ m/월드는 손으로 적지 않는다 — waveSpeed 에서 파생된다 (다음-세션 §7 : 손으로 옮긴 축척이 세 세션을 틀렸다)
import { metersPerWorld, groundSpeed } from './ocean-clock.js';

// ───────── 향 지도 좌표계 (2026-09-11) ─────────
// 향수 지도 CSV 의 정규화 좌표(map_x·map_y, 0~1)를 **월드 좌표**로 옮긴다.
// 부표(marks.js) · 자동 조타(zones.js) · (다음) 미니맵이 **전부 여기서** 받는다 —
// 변환식을 두 곳에 적으면 반드시 갈라진다 (불변식 2 의 BANDS 와 같은 규율).
//
// ⭐ 이것이 작업계획 [4단계] 의 *"토러스(wrapZ 100) → 유한 좌표"* 다. 지도 데이터가 어떻게 표출될지
//   몰라서 멈춰 있던 것이 CSV 가 오면서 풀렸다. ⚠ 예전 32개 더미 + 토러스는 `markMap 0` 으로 남아 있다.
//
// ── 규약
//   world X = (map_x − xMid) × size
//   world Z = −(map_y − yMid) × size        ← map_y 가 클수록 **북쪽**(−Z = head 0 의 뱃머리 방향)
//   ⚠ map_y 의 위아래 규약은 CSV 에 적혀 있지 않다. 수학식(위가 +)으로 가정했다 — 2D 지도와
//     뒤집혀 보이면 `mapFlipY 1` 한 값으로 뒤집는다 (미니맵도 여기서 받으므로 같이 뒤집힌다).
//   ⚠ scroll 은 배의 월드 위치를 (scroll.x, −scroll.z) 로 인코딩한다 (불변식 0-2).
//     그래서 부표의 씬 좌표는 (x − scroll.x, z + scroll.z) 다 — marks.js 가 그렇게 쓴다.
//   ⚠ 원점(0,0)이 지도의 **가운데**다. 배가 거기서 출발한다 (scroll 0,0).
//
// ── 크기 기준 (실측 2026-09-11, 1440×731 · 항해 구도)
//   한 화면에 부표가 뜰 수 있는 바다 ≈ **3,000 월드²** (배에서 38 월드 안의 부채꼴 — 부표 거리 페이드).
//   size 320 이면 **향수가 있는 자리마다 한 화면에 중앙값 약 10개**(예전 조정값 12.2 와 비슷하다),
//   지도의 약 30% 가 부표가 한 개도 안 보이는 **빈 바다**다. 수치표는 CHANGELOG v0.31.0.
//   ⚠ 배는 느리다 — 순항 0.84 · 자동 조타 1.27 · 부스트 1.71 월드/초 (파도 위상속도에 묶여 있다,
//     불변식 0-1). 320 을 부스트로 가로지르면 **3분**이다. 먼 곳은 미니맵 + 전환으로 간다 (다음 작업).

const FAM = Object.fromEntries(CONFIG.families.map(f => [f.key, f]));
const XS = PERFUMES.map(p => p.mx), YS = PERFUMES.map(p => p.my);
const X_MID = (Math.min(...XS) + Math.max(...XS)) / 2;
const Y_MID = (Math.min(...YS) + Math.max(...YS)) / 2;
const X_SPAN = Math.max(...XS) - Math.min(...XS);   // 1.00
const Y_SPAN = Math.max(...YS) - Math.min(...YS);   // 0.83 — 지도가 가로로 길다

let cacheKey = '', cache = null;

// 월드 좌표 한 벌을 만든다. 같은 인자면 캐시를 돌려준다 (배치는 값이 바뀔 때만 다시 한다)
export function scentMap({ size = 320, minGap = 3.0, home = 4.5, flipY = 0 } = {}) {
  const key = [size, minGap, home, flipY].join('|');
  if (key === cacheKey && cache) return cache;

  const fy = flipY >= 0.5 ? -1 : 1;
  const pts = PERFUMES.map((p, i) => {
    const x = (p.mx - X_MID) * size;
    const z = -fy * (p.my - Y_MID) * size;
    return { ...p, i, fam: FAM[p.family] || CONFIG.families[0], x0: x, z0: z, x, z };
  });

  // ── 겹침 풀기. ⚠⚠ CSV 에는 **거의 같은 자리의 쌍**이 있다 — 정규화 거리 0.0023 (Polo Blue ↔
  //   Le Vainqueur) · 0.0026 (Blanche ↔ Lazy Sunday Morning). size 320 에서 0.7~0.8 월드라
  //   부표(반지름 1.02)가 포개지고 **히트박스(2.85)는 둘을 가를 수 없다** — 무엇을 눌렀는지 모른다.
  //   그래서 최소 간격(minGap) 안의 쌍만 서로 반씩 밀어낸다. 전체 배치는 그대로다.
  //   ⚠ 난수를 안 쓴다 — 순서가 고정이라 새로고침해도 같은 자리다 (클릭해 본 향수가 딴 데 있으면 지도가 아니다).
  //   ⚠ 출항 지점(원점) 둘레 `home` 안도 비운다 — 첫 화면에서 배와 겹치면 지저분하다 (예전 scatter 와 같은 이유).
  for (let it = 0; it < 120; it++) {
    let moved = false;
    for (let a = 0; a < pts.length; a++) {
      const A = pts[a];
      const dh = Math.hypot(A.x, A.z);
      if (dh < home) {
        if (dh < 1e-6) { A.x = home; } else { const k = home / dh; A.x *= k; A.z *= k; }
        moved = true;
      }
      for (let b = a + 1; b < pts.length; b++) {
        const B = pts[b];
        const dx = B.x - A.x, dz = B.z - A.z;
        const d = Math.hypot(dx, dz);
        if (d >= minGap) continue;
        const push = (minGap - d) * 0.5;
        // 정확히 겹친 쌍은 방향이 없다 — x 축으로 가른다 (결정적이어야 한다)
        const ux = d > 1e-6 ? dx / d : 1, uz = d > 1e-6 ? dz / d : 0;
        A.x -= ux * push; A.z -= uz * push;
        B.x += ux * push; B.z += uz * push;
        moved = true;
      }
    }
    if (!moved) break;
  }

  // ── 존 대표 지점 = 그 향조 향수들의 **메도이드**(다른 향수들까지 거리 합이 가장 작은 향수).
  //   ⚠ 무게중심을 쓰지 않는다 — MUSK 처럼 넓게 흩어진 향조(σ 0.26~0.30)는 무게중심이
  //     **아무것도 없는 바다 한가운데**에 떨어진다. 메도이드는 늘 실제 향수 자리라 도착하면 부표가 보인다.
  const medoid = (arr) => {
    let best = null, bestS = Infinity;
    for (const p of arr) {
      let s = 0;
      for (const q of arr) s += Math.hypot(p.x - q.x, p.z - q.z);
      if (s < bestS) { bestS = s; best = p; }
    }
    return best ? { x: best.x, z: best.z, id: best.id, name: best.name, count: arr.length } : null;
  };
  // ⚠ v0.32.0 부터 **향조 = 존**이다 (config families 주석). 그래서 존 대표 지점이 곧 향조 대표 지점이다
  const byFamily = {};
  for (const p of pts) (byFamily[p.fam.key] ||= []).push(p);
  const familyAnchors = Object.fromEntries(Object.entries(byFamily).map(([k, a]) => [k, medoid(a)]));

  // ── 검산용 수치 (콘솔 · 문서에 인용할 때 여기서 가져온다)
  let movedN = 0, maxMove = 0, under = 0;
  for (const p of pts) {
    const m = Math.hypot(p.x - p.x0, p.z - p.z0);
    if (m > 0.01) movedN++;
    if (m > maxMove) maxMove = m;
  }
  for (let a = 0; a < pts.length; a++) for (let b = a + 1; b < pts.length; b++) {
    if (Math.hypot(pts[a].x - pts[b].x, pts[a].z - pts[b].z) < minGap - 1e-3) under++;
  }

  // ── 이 자리는 **어느 해역**인가 — 가장 가까운 향수의 향조 (향수들로 나눈 보로노이).
  //   미니맵에서 빈 바다를 눌러도 도착 연출에 이름이 있어야 한다 (사용자 : *"해당 영역 또는 바다의 빈곳을
  //   클릭했을 때에 해당 영역에 도착하면 좌우 연출이 시작되고"*). 200개 순회라 클릭·호버에서만 부른다
  const regionAt = (x, z) => {
    let best = null, bd = Infinity;
    for (const p of pts) { const d = (p.x - x) ** 2 + (p.z - z) ** 2; if (d < bd) { bd = d; best = p; } }
    return best ? { key: best.fam.key, name: best.fam.name, dist: Math.sqrt(bd), nearest: best } : null;
  };

  const bounds = {
    x0: -(X_MID - Math.min(...XS)) * size, x1: (Math.max(...XS) - X_MID) * size,
    z0: -Y_SPAN * 0.5 * size, z1: Y_SPAN * 0.5 * size
  };
  // ── **갈 수 있는 바다** (2026-09-11 오후 → 2026-09-12 저녁 개정).
  //   배를 막는 main.js 와 미니맵이 **둘 다 여기서** 받는다 — 두 곳에 적으면 갈라진다 (불변식 21)
  //
  // ⚠⚠ **2026-09-12 저녁 : 사각형이 아니라 향수에서 잰 거리다.** 사용자 :
  //   *"미니맵을 네모나게 움직이는게 끝이 아니라 … 향수가 밀집되어있는 공간 주변으로도 못나가게"*.
  //   갈 수 있는 바다 = **어느 향수든 `navReach` 안** (원들의 합집합). 그래서 경계가 향수 분포를 따라 굽는다.
  //   ⭐ 실측 (200개) : 최근접 이웃 거리 중앙 **6** · p90 11.3 · 최대 27 · **MST 최대 간선 32.3**.
  //     즉 reach **16.1** 이면 모든 덩어리가 하나로 이어진다 — 기본 45 는 그 두 배를 훌쩍 넘으므로
  //     섬처럼 끊긴 바다가 생기지 않는다. (부표 페이드가 38 이라 '보이는 만큼' 과도 맞는다)
  //   ⚠ `navRect` 는 이제 **담는 사각형**이다 (미니맵이 그릴 범위). 판정은 `inNav` 가 한다.
  const reachOf = () => Math.max(1, P.navReach === undefined ? 45 : P.navReach);

  // 가장 가까운 향수까지의 거리와 **바깥 방향**. main.js 가 경계에서 밀어내는 데 쓴다.
  // ⚠ 200개 순회다 — 배 한 점이라 프레임당 한 번이면 싸다 (regionAt 과 같은 자리).
  const navDist = (x, z) => {
    let bd = Infinity, bx = 0, bz = 0;
    for (const p of pts) { const dx = x - p.x, dz = z - p.z, d2 = dx * dx + dz * dz;
      if (d2 < bd) { bd = d2; bx = dx; bz = dz; } }
    const d = Math.sqrt(bd) || 0;
    // 바깥 = 최근접 향수에서 멀어지는 쪽. 정확히 겹치면 방향이 없다 (그때는 경계도 아니다)
    return d > 1e-6 ? { d, ux: bx / d, uz: bz / d } : { d: 0, ux: 0, uz: 0 };
  };
  const inNav = (x, z, extra = 0) => navDist(x, z).d <= reachOf() + extra;

  // 미니맵이 그릴 **담는 사각형** — 지도 범위에 reach 를 두른다
  const navRect = (margin = 0) => {
    const r = reachOf() + margin;
    return { x0: bounds.x0 - r, x1: bounds.x1 + r, z0: bounds.z0 - r, z1: bounds.z1 + r };
  };

  // ⭐⭐ **갈 수 있는 바다의 정확한 끝선** (2026-09-13, v0.50.0) — 원들의 합집합의 **바깥 호**.
  //   배를 막는 식이 `navDist ≤ navReach`, 곧 **원 200개의 합집합**이므로 경계는 원호를 이은 것이다.
  //   격자 마스크(navMask)를 늘려 그리면 확대했을 때 계단이 흐리게 보인다 (사용자 화면 — 해도 6배).
  //   원 i 에서 이웃 j(중심 거리 d < 2R)가 가리는 각 구간은 `j 쪽 방향 ± acos(d / 2R)` 다.
  //   가려진 구간을 합치고 **남은 구간**이 끝선이다. 200×200 = 4만 번 · 반경이 바뀔 때만 다시 굽는다.
  //   ⚠ 각은 월드 XZ 의 `atan2(dz, dx)` 다. 미니맵·해도는 z 를 화면 아래로 두고 균일 배율이라 **그대로** 쓴다
  //   ⚠ 호는 a0 < a1 이고 a1 이 2π 를 넘을 수 있다 (0 을 걸친 호). 가리는 이웃이 없는 원은 0 ~ 2π 다
  let outlineCache = null;
  const navOutline = (extra = 0) => {
    const R = reachOf() + extra;
    const key = R.toFixed(3) + '|' + pts.length;
    if (outlineCache && outlineCache.key === key) return outlineCache;
    const TAU = Math.PI * 2, EPSA = 1e-7;
    const arcs = [];
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i];
      const cov = [];
      let buried = false;
      for (let j = 0; j < pts.length && !buried; j++) {
        if (j === i) continue;
        const b = pts[j];
        const dx = b.x - a.x, dz = b.z - a.z, d = Math.hypot(dx, dz);
        if (d >= 2 * R) continue;
        // ⚠ 같은 자리의 원은 **앞선 하나만** 남긴다 — 둘 다 그리면 같은 호가 두 번 그려진다
        if (d < 1e-9) { if (j < i) buried = true; continue; }
        const c = Math.atan2(dz, dx), h = Math.acos(d / (2 * R));
        let s0 = (c - h) % TAU; if (s0 < 0) s0 += TAU;
        const s1 = s0 + 2 * h;
        if (s1 > TAU) cov.push([s0, TAU], [0, s1 - TAU]); else cov.push([s0, s1]);
      }
      if (buried) continue;
      if (!cov.length) { arcs.push({ x: a.x, z: a.z, a0: 0, a1: TAU }); continue; }
      cov.sort((p, q) => p[0] - q[0]);
      const gaps = [];
      let cur = 0;
      for (const [s0, s1] of cov) {
        if (s0 > cur + EPSA) gaps.push([cur, s0]);
        if (s1 > cur) cur = s1;
      }
      if (cur < TAU - EPSA) gaps.push([cur, TAU]);
      if (!gaps.length) continue;   // 통째로 묻힌 원 — 끝선에 안 나온다
      // 0 을 걸친 호는 하나로 잇는다 (첫 구간이 0 에서 시작하고 마지막 구간이 2π 에서 끝나면)
      if (gaps.length > 1 && gaps[0][0] <= EPSA && gaps[gaps.length - 1][1] >= TAU - EPSA) {
        const first = gaps.shift();
        gaps[gaps.length - 1][1] = TAU + first[1];
      }
      for (const [g0, g1] of gaps) if (g1 - g0 > 1e-6) arcs.push({ x: a.x, z: a.z, a0: g0, a1: g1 });
    }
    outlineCache = { key, r: R, arcs };
    return outlineCache;
  };

  cache = {
    size, minGap, flipY,
    points: pts,
    familyAnchors,
    zoneAnchors: familyAnchors,   // ⚠ 옛 이름 — 존 = 향조가 되면서 같은 표다
    regionAt,
    // ⚠ `navMask`(격자 132×110)는 2026-09-13 에 지웠다 — 미니맵·해도 모두 원들의 합집합과 `navOutline` 으로 그린다
    navRect, inNav, navDist, navOutline,
    // ⭐ 정규화 좌표(CSV 의 map_x·map_y · 지형 JSON 과 같은 공간) → 월드. **변환식은 이 파일 한 곳이다**
    //   (2026-09-12 저녁 — 해도의 향 영역 폴리곤이 이걸 쓴다. 불변식 21 : 두 곳에 적으면 갈라진다)
    //   ⚠ 여백 때문에 정규화 좌표가 0~1 을 넘을 수 있다 (지형 bounds 는 −0.05~1.05) — 식은 그대로 맞다
    toWorld: (nx, ny) => [(nx - X_MID) * size, -fy * (ny - Y_MID) * size],
    get navReach() { return reachOf(); },
    // 지도 사각형 (월드). 미니맵이 이걸 그린다
    bounds,
    span: { x: X_SPAN * size, z: Y_SPAN * size },
    stats: { moved: movedN, maxMove: +maxMove.toFixed(2), stillUnder: under }
  };
  cacheKey = key;
  return cache;
}

// 콘솔 한 줄 (PB.scentMap.report())
export function scentMapReport(opts) {
  const m = scentMap(opts);
  const mpw = metersPerWorld();
  // 부스트로 지도 가로를 건너는 시간 — 먼 곳을 왜 전환으로 가야 하는지가 이 숫자다
  const cross = m.span.x / Math.max(1e-6, groundSpeed(1.0));
  return `향 지도 ${m.span.x.toFixed(0)} × ${m.span.z.toFixed(0)} 월드 ` +
    `(${(m.span.x * mpw).toFixed(0)} × ${(m.span.z * mpw).toFixed(0)} m) · 향수 ${m.points.length} · ` +
    `겹침 풀기 ${m.stats.moved}개 최대 ${m.stats.maxMove} 월드 · 남은 겹침 ${m.stats.stillUnder} · ` +
    `부스트 횡단 ${(cross / 60).toFixed(1)}분`;
}
