/**
 * 3D 엔진의 배가 **지금 화면 어디에 있는가** — 선실 말풍선이 배를 따라다니는 데 씁니다 (2026-09-21).
 *
 * 값을 채우는 것은 엔진입니다(`landing/src/boat.js` 의 `screen` · `main.js` 의 tick).
 * `ScentScene` 이 엔진에 붙을 때 읽는 길을 여기 꽂고, `CabinBubble` 이 제 rAF 안에서 꺼내 씁니다.
 *
 * ⚠⚠ **React 상태로 올리지 않습니다.** 초당 60번 바뀌는 값이라 상태로 두면 그만큼 화면 전체가 다시
 * 그려지고, 그 다시 그리기가 3D 가 도는 것과 같은 스레드에서 일어납니다. 잠수 커튼이 진행도를
 * 다루는 규율과 같습니다(`shared/ui/DiveCurtain` · `shared/store/diveStore` 의 ⚠⚠).
 *
 * ⚠ zustand 가 아니라 모듈 변수인 이유는 **도메인 안에서만 오가기 때문**입니다 — 꽂는 곳과 읽는 곳이
 * 둘 다 `features/map` 입니다. 잠수는 헤더 · 지도 · 진열대 셋을 가로질러서 `shared/store` 가 필요했습니다.
 */
export interface BoatAnchor {
  /** 배(선체)의 화면 가운데 */
  x: number
  y: number
  /** 배 길이 절반의 화면 반지름 — 말풍선 크기를 배에 맞출 때 씁니다 */
  r: number
  /** 말풍선이 꼬리를 대는 점 = 배 옆구리 */
  ax: number
  ay: number
  /** 1 배의 오른쪽 · −1 왼쪽 (배가 화면 오른끝에 붙으면 엔진이 뒤집습니다) */
  side: number
  /** false 면 값이 낡았습니다 — 엔진이 갱신을 쉬는 중입니다 */
  on: boolean
}

let read: (() => BoatAnchor | null) | null = null

/** 엔진이 붙고 떨어질 때 `ScentScene` 이 부릅니다. null 이면 3D 가 없는 상태입니다 */
export function setBoatAnchorSource(fn: (() => BoatAnchor | null) | null) {
  read = fn
}

/** 지금 배의 화면 자리. 엔진이 없거나 값이 낡았으면 null 입니다 */
export function boatAnchor(): BoatAnchor | null {
  const anchor = read?.()
  return anchor && anchor.on ? anchor : null
}
