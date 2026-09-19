/**
 * 잠수 전환의 시계 — 메인(3D 향 지도)에서 진열대로 넘어갈 때 (2026-09-18)
 *
 * 설계 근거는 엔진 쪽 문서 `landing/docs/고도화-0917/03-로딩-전환-수중.md` §4-2 입니다.
 *
 * **시계를 앱이 쥡니다.** 3D 엔진(iframe)은 진행도 `k`(0~1)를 받기만 하고 (`PB.dive(k)` —
 * `landing/src/dive.js`), 커튼도 같은 `k` 로 차오릅니다. 두 판이 각자 시간을 재면 카메라가
 * 내려앉는 때와 물이 차오르는 때가 어긋납니다.
 *
 * 이 파일은 **숫자만** 냅니다 — DOM 도 라우터도 모릅니다 (`DiveCurtain` 이 씁니다).
 */

/** 잠수에 쓰는 시간(ms). 이 끝에 화면이 짙은 바다색으로 다 덮입니다 */
export const DIVE_MS = 1000

/**
 * 커튼이 차오르기 시작하는 진행도. 앞의 이만큼은 **3D 만** 움직입니다 —
 * 카메라가 고개를 숙이고 엔진 UI 가 비키는 것이 먼저 보여야 '내려간다' 로 읽힙니다.
 * 처음부터 차오르면 '판이 덮었다' 가 됩니다.
 */
export const COVER_FROM = 0.3

/**
 * 커튼이 걷히는 시간(ms).
 *
 * ⚠ `dive-curtain.css` 의 `--dive-lift` 와 **같은 값**이어야 합니다 — 여기가 짧으면 다 걷히기
 * 전에 판이 사라지고, 길면 다 걷힌 뒤에도 빈 판이 클릭을 먹습니다.
 * ⭐ 2026-09-18 : 600 → 1100 → **1400** (사용자 : *"걷히는 속도를 좀 느리게"* · *"더 부드럽게"*).
 *   마스크 기울기가 두 화면 높이로 늘어난 만큼 지나가는 거리도 길어졌습니다 (−200vh → −300vh).
 */
export const LIFT_MS = 1400

/**
 * 덮인 채로 **최소한 머무는 시간**(ms) — 진열대가 곧바로 준비돼도 이만큼은 있습니다.
 *
 * 2026-09-18 사용자 : *"진열대 페이지 자체에도 무거움이 존재해서 사실상 랜딩 잔류 시간이 좀 필요함"*.
 * 목록이 캐시에 있으면(10분 안에 다시 들어오면) 준비 신호가 **덮자마자** 와서, 느리게 걷는 커튼이
 * 시작하자마자 걷히기 시작합니다 — 잠수해서 내려앉은 것이 한 박자도 안 쉬고 되돌아가 보입니다.
 */
export const HOLD_MIN_MS = 420

/**
 * 진열대를 기다리는 상한(ms). 데이터가 늦어도 이만큼이면 걷습니다.
 *
 * ⭐ 2026-09-18 : 1500 → **2600** (사용자 : 진열대가 무겁다). 이 화면은 목록 한 번에 병 수백 개를
 * 받아 벽을 세우고 사진을 푸는 곳이라 1.5초로는 자주 모자랐습니다 — 모자라면 **덜 그려진 진열대가
 * 드러납니다.** 대신 아래 `-drift` 물결이 기다리는 동안 숨을 쉬어 멈춘 화면으로 안 읽히게 합니다.
 */
export const READY_CAP_MS = 2600

/**
 * 움직임 줄이기(`prefers-reduced-motion`)일 때의 잠수 시간(ms).
 * 카메라 잠수를 빼고 커튼만 짧게 덮습니다 (문서 §4-2 의 마지막 줄).
 */
export const REDUCED_MS = 200

/** 이 프로젝트의 집 커브 — 엔진 `phase.js` 의 `inOutCubic` 과 같은 식입니다 */
export const inOutCubic = (t: number): number =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2

/**
 * 커튼이 차오르는 커브 — **느리게 시작해 끝에서 삼킨다** (2026-09-18).
 *
 * ⚠⚠ 집 커브(`inOutCubic`)를 안 쓰는 자리입니다. 커튼이 `scaleY` 로 아래끝에서 자라게 되면서
 * (`dive-curtain.css` 머리말) 번짐이 **차오름 0.44 만에 화면 꼭대기에 닿습니다** — 판을 밀어
 * 올리던 때보다 훨씬 빨리 덮입니다. 가운데가 빠른 `inOutCubic` 을 그대로 두면 잠수 중반에
 * 이미 3D 가 안 보여서, **카메라가 내려가는 것 자체를 못 봅니다.**
 *
 * `t²` 는 앞을 비워 3D 를 오래 보여 주고 뒤에서 빠르게 삼킵니다 (차오름이 화면 꼭대기에 닿는
 * 때 : `inOutCubic` k 0.65 → **k 0.76**).
 */
const coverEase = (t: number): number => t * t

const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v)

export interface DiveFrame {
  /** 엔진에 넘기는 진행도 0~1 (1 = 화면을 다 덮은 순간) */
  k: number
  /** 커튼이 차오른 정도 0~1 (1 = 화면 전체가 짙은 바다색) */
  cover: number
  /** 다 덮었는가 — 이때 진열대로 옮겨 갑니다 */
  covered: boolean
}

/**
 * 잠수 시작에서 `elapsed` ms 지난 지금의 값.
 *
 * ⚠ `cover` 는 `k` 를 그대로 쓰지 않습니다 — `COVER_FROM` 부터 시작해 **같은 1.0 에서 끝납니다.**
 *   두 값을 하나로 합치면 커튼이 3D 보다 먼저 올라오거나 늦게 닿습니다.
 */
export function diveFrameAt(elapsed: number, duration = DIVE_MS): DiveFrame {
  const k = clamp01(elapsed / Math.max(1, duration))
  const cover = coverEase(clamp01((k - COVER_FROM) / (1 - COVER_FROM)))
  return { k, cover, covered: k >= 1 }
}

/** 움직임 줄이기면 3D 를 안 건드리고 커튼만 짧게 덮습니다 */
export function diveDuration(reducedMotion: boolean): number {
  return reducedMotion ? REDUCED_MS : DIVE_MS
}
