import * as THREE from 'three';
import { CONFIG } from './config.js';

export const lerp = (a, b, t) => a + (b - a) * t;
export const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
export const D2R = Math.PI / 180;

// 월드 XZ → 시뮬레이션 uv
export function toUv(x, z) {
  const S = CONFIG.sim;
  return [0.5 + x / S.domain, 0.5 - (z - S.centerZ) / S.domain];
}

// 각도 오차를 [−π, π] 로 접는다. **두 방향의 차를 재는 곳에서는 항상 이걸 거친다.**
// ⚠ nav.head 는 무한 누적된다 (±π 로 안 감싼다 — 시각 요를 매끄럽게 보간하려고 일부러 그렇다).
//   그래서 누적된 head 를 유한한 목표각과 그냥 빼면 오차가 몇 바퀴어치로 나온다.
export function wrapPi(a) { return Math.atan2(Math.sin(a), Math.cos(a)); }

// ───────── 수평선 ─────────
// 무한히 먼 수면(y = 0)이 화면 세로 어디에 맺히는가. **1 을 넘으면 화면 위로 벗어난다.**
//
// ⚠⚠ **종횡비와 무관하다.** 창을 넓혀도 수평선은 안 움직인다 — pitch 와 수직 화각만 정한다.
// ⚠ `fovDeg` 는 three 의 **수직** 화각(`cam.fov`)이다. 수평으로 착각하면 값이 통째로 틀어진다.
// ⚠ `pitchDeg` 는 광축의 **하향각**이다. `main.js` 의 구면 좌표 배치와 `lookAt` 이 맞물려
//   있어서 `params.camPitch` 와 정확히 같다 (2026-09-09 실측 : 23.100° 일치).
//
// 검산 : 카메라 전방 무한원점(1e6)을 실제로 투영한 값과 **오차 4.5e-5** 로 일치했다.
// 자세한 것은 `docs/무대와-존-연출.md` §12.
export function horizonNDC(pitchDeg, fovDeg) {
  return Math.tan(pitchDeg * D2R) / Math.tan(fovDeg * 0.5 * D2R);
}

// 수평선을 화면 세로 `frac`(0 = 맨 위, 1 = 맨 아래) 에 두려면 pitch 가 얼마여야 하는가.
// `horizonNDC` 의 역이다. ⚠ fov 가 속도에 따라 변하므로 **어느 fov 기준인지** 같이 정한다.
export function pitchForHorizon(frac, fovDeg) {
  return Math.atan((1 - 2 * frac) * Math.tan(fovDeg * 0.5 * D2R)) / D2R;
}

// 선 명암 폭. contrast 0 = 한 톤, 1 = 골은 먹으로 · 마루는 배경으로
export function lineTones(k) {
  const base = new THREE.Color(CONFIG.line.color);
  return {
    dark: base.clone().lerp(new THREE.Color(CONFIG.color.text), 0.55 * k),
    light: base.clone().lerp(new THREE.Color(CONFIG.color.bg), 0.55 * k)
  };
}

// HalfFloat 렌더타깃 읽기용 (부력 프로브가 rtA 를 직접 읽는다)
export function h2f(h) {
  const s = (h & 0x8000) ? -1 : 1, e = (h >> 10) & 0x1f, f = h & 0x3ff;
  if (e === 0) return s * f * 5.9604644775390625e-8;
  if (e === 31) return 0;
  return s * Math.pow(2, e - 15) * (1 + f / 1024);
}

// ───────── 격자 → 부드러운 닫힌 고리 (2026-09-18) ─────────
// 마칭 스퀘어로 칸 경계를 잇고 Chaikin 으로 둥글린다. **경계를 격자에서 뽑는 곳은 전부 여기를 쓴다** —
//   `scentmap.navLoops`(갈 수 있는 바다 · 해도와 미니맵이 같이 읽는다) · `chart.js` 의 안개 윤곽.
//   두 곳에 적으면 같은 자리가 다른 모양으로 갈라진다 (불변식 2).
//
//   C · R    칸 수 (가로 · 세로)
//   at(i,j)  그 칸이 안쪽이면 1 (격자 밖은 0)
//   toXZ(k)  꼭짓점 키 → [x, z]. 키는 **두 배 정수 좌표**다 (아래 key2 참고)
//   rounds   Chaikin 횟수. 칸이 성기면 3, 촘촘하면 2 — 더 돌린다고 더 부드러워지지 않고 **면적만 준다**
export function traceGrid(C, R, at, toXZ, rounds) {
  // 변 중점을 두 배 정수 좌표로 적는다 — (2i+1, 2j) 는 칸 중점 (i,j)–(i+1,j) 사이다.
  //   같은 점이 같은 키가 되므로 이웃 칸의 선분이 저절로 이어진다
  const key2 = (X, Y) => (X + 4) * 65536 + (Y + 4);
  const adj = new Map();
  const seg = (p, q) => {
    const a = key2(p[0], p[1]), b = key2(q[0], q[1]);
    if (!adj.has(a)) adj.set(a, []);
    if (!adj.has(b)) adj.set(b, []);
    adj.get(a).push(b); adj.get(b).push(a);
  };
  // ⚠ 격자 바깥 한 줄까지 돈다 — 가장자리에 닿은 덩어리도 닫힌 고리가 된다
  for (let j = -1; j < R; j++) for (let i = -1; i < C; i++) {
    const c = (at(i, j) << 3) | (at(i + 1, j) << 2) | (at(i + 1, j + 1) << 1) | at(i, j + 1);
    if (c === 0 || c === 15) continue;
    const T = [2 * i + 1, 2 * j], Rt = [2 * i + 2, 2 * j + 1], B = [2 * i + 1, 2 * j + 2], L = [2 * i, 2 * j + 1];
    switch (c) {
      case 1: case 14: seg(L, B); break;
      case 2: case 13: seg(B, Rt); break;
      case 3: case 12: seg(L, Rt); break;
      case 4: case 11: seg(T, Rt); break;
      case 6: case 9: seg(T, B); break;
      case 7: case 8: seg(L, T); break;
      // 대각 안장 — 둘을 **갈라** 둔다 (꼭짓점만 닿은 칸은 이어진 덩어리가 아니다)
      case 5: seg(T, Rt); seg(L, B); break;
      case 10: seg(L, T); seg(B, Rt); break;
    }
  }
  const chaikin = (p) => {
    const o = [];
    for (let i = 0; i < p.length; i++) {
      const a = p[i], b = p[(i + 1) % p.length];
      o.push([a[0] * 0.75 + b[0] * 0.25, a[1] * 0.75 + b[1] * 0.25], [a[0] * 0.25 + b[0] * 0.75, a[1] * 0.25 + b[1] * 0.75]);
    }
    return o;
  };
  const done = new Set(), loops = [];
  for (const start of adj.keys()) {
    if (done.has(start)) continue;
    const lp = [];
    let prev = -1, cur = start;
    for (let guard = 0; guard < 100000; guard++) {
      done.add(cur); lp.push(cur);
      const nb = adj.get(cur);
      const next = nb[0] !== prev ? nb[0] : nb[1];
      prev = cur; cur = next;
      if (cur === start || cur === undefined) break;
    }
    if (lp.length < 4) continue;
    let pts = lp.map(toXZ);
    for (let n = 0; n < rounds; n++) pts = chaikin(pts);
    loops.push(pts);
  }
  return loops;
}
