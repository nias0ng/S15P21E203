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
