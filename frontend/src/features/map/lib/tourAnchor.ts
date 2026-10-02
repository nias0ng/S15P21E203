/**
 * 첫 방문 안내가 3D 의 **무엇 곁에** 설 것인가 — 엔진이 매 프레임 그 상자를 채웁니다 (`landing/src/main.js` 의
 * `measureTour` · `PB.tour`). 바다 · 방향키(배 옆구리) · 부표 · 닮은 향수 · 카드 · 해역 안내 · 미니맵 · 배처럼
 * 자리를 엔진만 아는 단계가 씁니다.
 *
 * `ScentScene` 이 엔진에 붙을 때 읽는 길을 꽂고, `SceneTourTip` 이 제 rAF 안에서 꺼내 씁니다 —
 * 배 자리(`boatAnchor`)와 같은 규율입니다. 초당 60번 바뀌는 값이라 React 상태로 올리지 않습니다.
 *
 * NOTE: 이름은 엔진 `main.js` 의 `TOUR_WATCH` 와 같아야 합니다 — 모르는 이름이면 엔진이 아무것도 안 잽니다.
 */
export type TourAnchorStep =
  'sea' | 'keys' | 'buoy' | 'similar' | 'card' | 'zone' | 'minimap' | 'boat'

export interface TourAnchor {
  /** 붙을 상자 — 화면(뷰포트) 기준 CSS px. 배는 폭이 0 인 옆구리 선입니다 */
  x: number
  y: number
  w: number
  h: number
  /** 배만 씁니다 — 1 배의 오른쪽에 · −1 왼쪽에 섭니다 (배가 화면 오른끝에 붙으면 엔진이 뒤집습니다) */
  side: number
  /**
   * 스포트라이트(`TourSpotlight`)가 밝힐 상자 — 뷰포트 CSS px. 안내가 붙는 상자와 밝힐 것이 다른 단계만 줍니다
   * (배는 옆구리 선이 아니라 배 둘레 · 부표는 이름표와 그 밑의 부표까지). 없거나 null 이면 위 상자를 밝힙니다
   */
  hole?: { x: number; y: number; w: number; h: number } | null
}

interface TourAnchorSource {
  /** 엔진에 무엇을 잴지 알립니다. null 이면 재지 않습니다 */
  watch: (step: TourAnchorStep | null) => void
  read: () => TourAnchor | null
  /** 3D 를 멈춥니다(그리기를 쉽니다) · 되살립니다 — 설명하는 안내가 막을 씌운 동안 */
  freeze: (on: boolean) => void
}

let source: TourAnchorSource | null = null

/** 엔진이 붙고 떨어질 때 `ScentScene` 이 부릅니다. null 이면 3D 가 없는 상태입니다 */
export function setTourAnchorSource(next: TourAnchorSource | null) {
  source = next
}

/** 엔진에 이 단계의 자리를 재 달라고 합니다 — 안내가 서 있는 동안만 겁니다 */
export function watchTourAnchor(step: TourAnchorStep | null) {
  source?.watch(step)
}

/** 지금 그 자리. 엔진이 없거나 아직 못 쟀으면(부표가 안 보인다 · 카드가 닫혔다) null 입니다 */
export function tourAnchor(): TourAnchor | null {
  return source?.read() ?? null
}

/**
 * 3D 를 멈춥니다 · 되살립니다 (엔진 `PB.tour.freeze`). 설명하는 안내가 막을 씌운 동안만 겁니다 — 멈춘 동안에도
 * 엔진은 안내의 자리를 계속 잽니다. 엔진이 없으면 아무 일도 안 합니다
 */
export function freezeTourScene(on: boolean) {
  source?.freeze(on)
}
