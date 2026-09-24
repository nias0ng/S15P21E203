import { PARAMS as P } from './params.js';
import { EASE } from './phase.js';

// ───────── 선실로 들어가기 — 진열대로 넘어가는 전환 (2026-09-24) ─────────
// 메인에서 진열대(· 컬렉션)로 갈 때 카메라가 **배를 향해 곧게 줌인**하고, 앱이 그 배에서
// 구름(메인에 들어올 때 걷히던 그 구름)을 스며 번지게 해 화면을 덮은 뒤 진열대로 넘어간다.
// 카메라는 배로 **향해 가는** 것까지만 보인다 — 고개를 돌리거나, 갑판에 붙거나, 위에서 내려오지 않는다
// (2026-09-24 사용자 : *"약간 역동적이되 빠르게 카메라가 배 가까이 갈 필요는 없음"* ·
//  *"문쪽으로 향하기 위해 오른쪽으로 카메라 무빙이 있는데 그렇게 안해도댐 그냥 배쪽으로 줌인"*).
// 잠수(`dive.js`)와 같은 틀이다 — 시계는 앱 커튼이 쥐고 엔진은 진행도 `k`(0~1)를 받기만 한다
// (`PB.cabinIn(k)` → `setCabinIn`). 여기에도 dt 도 update() 도 없다.
//
// ⚠⚠ **잠수와 축이 다르다.** 잠수는 수면으로 **내려가고**(콘텐츠 다섯 — 바다 밑), 이쪽은 배 **안으로**
//   들어간다(진열대 — 배의 선실). 2026-09-20 에 진열대를 잠수에서 뺀 까닭이 이것이다 — 같은 축에 세우면
//   둘이 서로를 흉내 낸다 (S15P21E203-340). 그래서 여기는 **색을 안 건드린다** — 물 · 하늘은 그대로 두고
//   카메라만 배로 간다. 덮는 것은 앱의 몫이다 (`shared/ui/cabin-curtain.css`).
//
// ⚠ 이 층도 **값을 풀어 주는 것**뿐이다 — 씬도 커튼도 모른다. 읽는 곳은 main.js 의 카메라 한 곳이다.
//   ⚠ `cabinInNow()` 가 유일한 입구다 (dive.js 의 `diveNow()` 와 같은 자리).

// 앱이 넘긴 진행도 (0 = 항해 · 1 = 앱 커튼이 화면을 다 덮은 순간)
let _k = 0;
// 엔진 UI 가 비켰는가 — DOM 은 이 한 번의 속성 쓰기뿐이다 (잠수와 같은 규칙 · index.html)
let _uiOff = false;

// ⚠ 소비자가 매 프레임 부르므로 객체를 새로 만들지 않는다 — 이 하나를 고쳐 돌려준다
const state = { k: 0, push: 0 };

/**
 * 앱 커튼이 진행도를 넘긴다 (`PB.cabinIn`). 0 이면 항해로 되돌아온다.
 *
 * ⚠ 엔진 UI 는 **CSS 전환**으로 비킨다 (`<html data-cabin-in>` · index.html 에서 잠수와 같은 규칙).
 *   매 프레임 opacity 를 쓰면 칠하기 단계가 커튼이 번지는 그 순간과 겹친다.
 */
export function setCabinIn(k) {
  _k = k > 0 ? (k > 1 ? 1 : k) : 0;
  const on = _k > 0.001 && (P.cabinInAmount === undefined ? 1 : P.cabinInAmount) > 0
    && (P.cabinInUi === undefined ? 1 : P.cabinInUi) >= 0.5;
  if (on === _uiOff) return;
  _uiOff = on;
  const html = document.documentElement;
  if (on) html.dataset.cabinIn = '1';
  else delete html.dataset.cabinIn;
}

/**
 * 지금 들어가는 중인가. **아니면 null** — 소비자는 null 이면 예전 값을 그대로 쓴다
 * (`cabinInAmount 0` 이 비트 단위 롤백이다 · dive.js 와 같은 규약).
 *
 *   push  배로 다가간 정도 0~1 — 거리의 **로그** 비율이다 (main.js 가 기하급수로 줄인다).
 *         그래서 화면에서 배가 **일정한 비율로** 커진다 — 선형으로 줄이면 끝에서 갑자기 부푼다.
 */
export function cabinInNow() {
  const amt = P.cabinInAmount === undefined ? 1 : P.cabinInAmount;
  if (_k <= 0.001 || amt <= 0) return null;
  state.k = _k;
  // 느리게 떠나 가운데서 빨라지고 끝에서 선다 — 선 자리에서 앱의 구름이 다 덮는다
  state.push = EASE.inOutCubic(_k) * amt;
  return state;
}

/** 콘솔 검증용 한 줄 (`PB.cabinInReport()` — `PB.diveReport` 와 같은 자리) */
export function cabinInReport() {
  const C = cabinInNow();
  if (!C) return `idle  k=${_k.toFixed(3)}`;
  return `k=${C.k.toFixed(3)} push=${C.push.toFixed(3)} end=${P.cabinInEnd} fov=${P.cabinInFov}`;
}

/** ⚠ HMR · 언마운트에서 속성을 걷어 둔다 — 남으면 엔진 UI 가 영영 안 보인다 (불변식 10) */
export function disposeCabinIn() {
  setCabinIn(0);
  _k = 0;
}
