import { create } from 'zustand'

/**
 * 잠수 전환이 지금 어디쯤인가 (메인 3D ↔ 콘텐츠 화면, 2026-09-18).
 *
 *   idle     평소
 *   diving   3D 카메라가 수면으로 내려가고 커튼이 차오른다. 시계는 `DiveCurtain` 이 쥔다
 *   covered  화면이 짙은 바다색으로 다 덮였다 — 이 사이에 간 화면으로 옮겨 간다
 *   lifting  간 화면이 준비돼 커튼이 걷히는 중
 */
export type DiveStage = 'idle' | 'diving' | 'covered' | 'lifting'

/**
 * 어느 쪽으로 가는가 (2026-09-19).
 *
 *   dive  메인 → 콘텐츠. 가라앉는다 — 커튼이 아래에서 차오르고 아래에서부터 트인다
 *   rise  콘텐츠 → 메인. 떠오른다 — 위에서 덮이고 위에서부터 트인다
 *
 * 단계(stage)는 둘이 같습니다. 다른 것은 **방향과 색**뿐이라 커튼이 판을 통째로 뒤집어
 * 씁니다 (`dive-curtain.css` 의 `[data-way='rise']`).
 */
export type DiveWay = 'dive' | 'rise'

interface DiveState {
  stage: DiveStage
  /** 가라앉는가 떠오르는가. `idle` 일 때의 값은 뜻이 없습니다 */
  way: DiveWay
  /** 덮은 뒤 갈 곳 (`ROUTES` 의 값). 커튼이 `navigate` 합니다 */
  to: string | null
  /**
   * 이번 전환이 **얼마나 깊은가** 0~1 — 화면마다 다릅니다 (`diveTrack` 의 `DIVE_DEPTH`).
   *
   * 내려가는 **시간**과 커튼의 **끝 색**이 이 한 값에서 나옵니다. 거는 쪽(`GlobalHeader`)이
   * 정해서 넘기고 커튼은 받아 쓰기만 합니다 — 커튼이 주소를 보고 표를 뒤지면, 떠오를 때
   * (이미 주소가 바뀐 뒤) 어디서 왔는지 알 수가 없습니다.
   * ⚠ `idle` 일 때의 값은 뜻이 없습니다.
   */
  depth: number
  /** 간 화면이 그릴 준비가 됐는가 (`useDiveReady`). 이 신호나 상한 중 먼저 오는 쪽에 걷습니다 */
  ready: boolean
  /**
   * 3D 엔진에 진행도를 넘기는 문 — `ScentScene` 이 엔진(`window.PB.dive`)을 찾아 꽂습니다.
   * null 이면 **커튼만** 올라옵니다 (엔진이 아직 안 떴거나 메인이 아닌 화면).
   */
  engine: ((k: number) => void) | null

  setEngine: (dive: ((k: number) => void) | null) => void
  /** 전환을 겁니다. 이미 걸려 있으면 아무 일도 없습니다 */
  start: (to: string, way?: DiveWay, depth?: number) => void
  /** 다 덮었습니다 — 커튼이 부릅니다 */
  markCovered: () => void
  /** 간 화면이 준비됐습니다 */
  markReady: () => void
  /** 걷기 시작 */
  lift: () => void
  /** 다 걷혔습니다 (또는 전환을 접습니다) */
  end: () => void
}

/**
 * 메인(3D 향 지도)과 콘텐츠 화면 사이를 넘나드는 잠수 전환의 상태 (전역 클라이언트 상태).
 *
 * **왜 `shared/store` 인가** — 이 전환은 **한 화면의 것이 아닙니다.** 거는 곳은 헤더(`app/layouts`),
 * 3D 를 내리는 곳은 향 지도(`features/map`), 준비됐다고 알리는 곳은 간 화면(`pages`)이고,
 * 커튼은 경로가 바뀌어도 살아 있어야 해서 껍데기(`RootLayout`)에 섭니다. `features/a` 는
 * `features/b` 를 모르므로(레이어 규칙) 그 사이를 이을 자리는 여기뿐입니다 —
 * 3D 하늘을 헤더에 잇는 `sceneSkyStore` 와 같은 까닭, 같은 자리입니다.
 *
 * ⚠⚠ **진행도(k)는 여기 없습니다.** 초당 60번 오는 값이라 상태로 두면 앱 전체가 그만큼 다시
 * 그립니다 — 그리고 그 다시 그리기가 3D 가 뜨는 것과 같은 스레드에서 일어납니다.
 * `DiveCurtain` 이 rAF 안에서 DOM 과 엔진에 **직접** 씁니다 (로딩 커튼 `useSceneBoot` 와 같은 규율).
 * 여기 있는 것은 **단계**뿐입니다.
 */
export const useDiveStore = create<DiveState>()((set, get) => ({
  stage: 'idle',
  way: 'dive',
  to: null,
  depth: 0,
  ready: false,
  engine: null,

  setEngine: (dive) => set({ engine: dive }),

  start: (to, way = 'dive', depth = 0) => {
    if (get().stage !== 'idle') return
    set({ stage: 'diving', way, to, depth, ready: false })
  },
  markCovered: () => set({ stage: 'covered' }),
  markReady: () => set({ ready: true }),
  lift: () => set({ stage: 'lifting' }),
  end: () =>
    set({ stage: 'idle', way: 'dive', to: null, depth: 0, ready: false }),
}))

/** 전환이 걸려 있는가 — 화면 위에 얹은 UI 가 같이 비킬 때 씁니다 (메인의 검색창 · 향해 일지) */
export const useIsDiving = () => useDiveStore((state) => state.stage !== 'idle')

/**
 * **떠오르는 중인가** — 간 화면이 제 UI 를 비킬 때 씁니다.
 *
 * ⚠ `useIsDiving` 을 쓰면 안 되는 자리입니다. 도착 화면은 **들어올 때도**(dive 의 covered ·
 * lifting) 전환 중이라, 그걸로 가리면 도착해서 드러나야 할 화면이 비어 보입니다.
 * 나가는 쪽(rise)일 때만 비킵니다.
 */
export const useIsRising = () =>
  useDiveStore((state) => state.stage !== 'idle' && state.way === 'rise')
