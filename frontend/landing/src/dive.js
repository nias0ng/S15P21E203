import * as THREE from 'three';
import { PARAMS as P } from './params.js';
import { EASE } from './phase.js';

// ───────── 잠수 — 진열대로 넘어가는 전환 (2026-09-18) ─────────
// 설계는 `docs/고도화-0917/03-로딩-전환-수중.md` §4 다. 이 파일은 그 §4-1 의 **A + B** 조합에서
// 엔진이 맡는 몫(B, 그리고 카메라)의 중립 값 한 곳이다.
//
// ⚠⚠⚠ **시계는 이 파일이 쥐지 않는다.** 진행도 `k`(0~1) 를 **앱 커튼이** 넘긴다
//   (`PB.dive(k)` → `setDive`). 커튼과 엔진이 각자 시간을 재면 두 판이 어긋난다 —
//   그 판단의 근거는 위 문서 §4-2 다. 그래서 여기에는 dt 도 update() 도 없다.
//
// ⚠⚠ **카메라는 수면을 뚫지 않는다.** 지금 바다는 위에서만 그려지는 판 한 장이라
//   (`water.js` 의 수면 메시가 `side` 를 안 줘 앞면만 · `sky.js` 는 수평선 아래가 한 색)
//   아래로 내려가면 물이 종이처럼 사라지고 복숭아빛 빈 공간에 부표가 뜬다 (문서 §4 표).
//   그래서 `diveEndY` 위에 서고, 뚫기 전에 **앱 커튼이 덮는다.**
//   진짜 물속(수면 뒷면 셰이더 · 스넬의 창)은 문서 §4-1 의 C 이고 1초 연출에는 과하다.
//
// ⚠ 이 층이 하는 일은 **값 하나를 풀어 주는 것**뿐이다 — 씬도 커튼도 모른다 (phase.js 와 같은 규율).
//   읽는 곳은 셋이다 :
//     main.js   카메라 (cameraPose 뒤 한 곳) · scene.background · 거리 페이드 배율(kD)
//     water.js  물 팔레트 · 원경색(uBg)
//     stage.js  하늘 판 (짙은 물색으로 눕는다)
//   ⚠ `diveNow()` 가 **유일한 입구**다 (times.js 의 `timeNow()` 와 같은 자리 · 불변식 25 의 규율).
//     모듈마다 `P.dive*` 를 따로 읽으면 한 층만 안 잠긴다.
//
// ⚠ THREE 를 들이는 까닭은 **색 하나를 캐시하기 위해서다.** 씬 객체는 만들지도 만지지도 않는다 —
//   소비자 셋이 각자 `new THREE.Color(hex)` 를 매 프레임 파싱하는 것을 막을 뿐이다.

// 앱이 넘긴 진행도 (0 = 항해 · 1 = 커튼이 화면을 다 덮은 순간)
let _k = 0;
// 엔진 UI(검색창 · 미니맵 · 카드 · 이름표)가 비켰는가 — DOM 은 이 한 번의 속성 쓰기뿐이다
let _uiOff = false;

// ⚠ 소비자가 매 프레임 부르므로 **객체를 새로 만들지 않는다** — 이 하나를 고쳐 돌려준다
const state = { k: 0, cam: 0, dim: 0, deep: null };
const _deep = new THREE.Color();
let _deepHex = '';

/** 잠수가 내려앉는 짙은 바다색. ⚠ 문자열이라 파싱을 캐시한다 (params 에서 바뀔 수 있다) */
function deepColor() {
  const hex = P.diveDeep === undefined ? '#1E2947' : P.diveDeep;
  if (hex !== _deepHex) { _deepHex = hex; _deep.set(hex); }
  return _deep;
}

/**
 * 색이 다 짙어지는 지점 (k) — `params.diveDimEnd`. 커튼이 화면을 덮는 1.0 보다 **앞**이다 (아래 `dim` 주석).
 * ⚠ 커튼이 차오르는 동안 실제로 보이는 구간은 k 0.3~0.7 이라, 이 값을 당기면 그 구간이 통째로 짙어진다 —
 *   '더 짙게' 는 `diveDim` 보다 여기가 크게 듣는다.
 */
const dimEnd = () => {
  const v = P.diveDimEnd === undefined ? 0.62 : P.diveDimEnd;
  return v < 0.05 ? 0.05 : v > 1 ? 1 : v;
};

/** 구간 잘라 읽기 — k 가 [a, b] 를 지나는 동안 0 → 1 */
const sub = (k, a, b) => (k <= a ? 0 : k >= b ? 1 : (k - a) / (b - a));

/**
 * 앱 커튼이 진행도를 넘긴다 (`PB.dive`). 0 이면 항해로 되돌아온다.
 *
 * ⚠ 엔진 UI 는 **CSS 전환**으로 비킨다 (`<html data-dive>` · index.html 의 규칙 한 줄).
 *   매 프레임 opacity 를 쓰면 칠하기 단계가 커튼이 올라오는 그 순간과 겹친다 —
 *   속성 한 번이면 합성 스레드가 알아서 민다 (scene-boot 커튼과 같은 이유).
 */
export function setDive(k) {
  _k = k > 0 ? (k > 1 ? 1 : k) : 0;
  const on = _k > 0.001 && (P.diveAmount === undefined ? 1 : P.diveAmount) > 0
    && (P.diveUi === undefined ? 1 : P.diveUi) >= 0.5;
  if (on === _uiOff) return;
  _uiOff = on;
  const html = document.documentElement;
  if (on) html.dataset.dive = '1';
  else delete html.dataset.dive;
}

/**
 * 지금 잠수 상태. **잠수 중이 아니면 null** — 소비자는 null 이면 예전 값을 그대로 쓴다
 * (times.js 의 낮이 null 인 것과 같은 규약이라, `diveAmount 0` 이 비트 단위 롤백이다).
 *
 *   cam  카메라 하강 0~1 — 끝까지 간다
 *   dim  색이 짙어진 정도 0~1 — `diveDim` 을 **이미 곱한 값**이다 (소비자 넷이 같은 값을 봐야 색이 갈라지지 않는다).
 *        **커튼이 다 덮기 전에 먼저 끝난다** (위 `dimEnd`) —
 *        늦게 끝나면 커튼 꼭대기와 3D 사이에 밝은 띠가 한 줄 남는다
 *   deep 내려앉는 짙은 바다색 (THREE.Color · 캐시된 참조. 복사해 쓴다)
 */
export function diveNow() {
  const amt = P.diveAmount === undefined ? 1 : P.diveAmount;
  if (_k <= 0.001 || amt <= 0) return null;
  state.k = _k;
  // 느리게 시작해 고르게 내려간다 — 앞이 빠르면 '떨어진다' 로 읽힌다
  state.cam = EASE.inOutCubic(_k) * amt;
  state.dim = EASE.outQuad(sub(_k, 0, dimEnd())) * amt * (P.diveDim === undefined ? 1 : P.diveDim);
  state.deep = deepColor();
  return state;
}

/** 콘솔 검증용 한 줄 (phase.report 와 같은 자리) */
export function diveReport() {
  const D = diveNow();
  if (!D) return `idle  k=${_k.toFixed(3)}`;
  return `k=${D.k.toFixed(3)} cam=${D.cam.toFixed(3)} dim=${D.dim.toFixed(3)} deep=${_deepHex} dimEnd=${dimEnd()}`;
}

/** ⚠ HMR · 언마운트에서 속성을 걷어 둔다 — 남으면 엔진 UI 가 영영 안 보인다 (불변식 10) */
export function disposeDive() {
  setDive(0);
  _k = 0;
}
