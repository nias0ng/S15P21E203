import { create } from 'zustand'
import { persist } from 'zustand/middleware'

/**
 * 메인(3D 향 지도) 첫 방문 안내의 단계. 차례가 곧 **둘이 같이 뜨고 싶을 때 먼저 서는 쪽**입니다.
 *
 *   welcome  첫 화면 — 여기가 무엇을 하는 곳인가 (검색창 아래)
 *   search   검색창을 처음 눌렀을 때 — 자연어 · 이름의 차이
 *   buoy     부표 — 눌러 보라 (엔진이 부표 곁에 그립니다)
 *   card     첫 향수 카드 — 단추 셋의 차이
 *   zone     첫 해역 — 해역의 뜻 · 나가는 법
 *   minimap  미니맵 · 탐색 %
 *   log      향해 일지에 첫 기록이 생겼을 때
 *   boat     배 · 선실 · 진열대
 *   results  첫 추천 결과 — 카드를 누르면 이유가 펼쳐진다
 */
export const TOUR_STEPS = [
  'welcome',
  'search',
  'buoy',
  'card',
  'zone',
  'minimap',
  'log',
  'boat',
  'results',
] as const

export type TourStep = (typeof TOUR_STEPS)[number]

/**
 * 앞 단계가 끝나야 서는 단계. `all` 은 모두, `any` 는 하나라도 끝나야 합니다.
 * 적지 않은 단계는 제 조건이 맞는 순간 섭니다 (그 화면에 처음 왔을 때).
 */
const AFTER: Partial<Record<TourStep, { all?: TourStep[]; any?: TourStep[] }>> =
  {
    buoy: { all: ['welcome'] },
    minimap: { any: ['card', 'zone'] },
    boat: { all: ['minimap', 'log'] },
  }

type TourProgress = {
  /** 끝낸 단계 — 그 행동을 했거나 [×] 로 닫은 것 */
  done: TourStep[]
  /** [안내 그만 보기] — 남은 단계를 한꺼번에 끕니다 */
  off: boolean
}

type TourState = TourProgress & {
  /** 제 조건이 맞아 뜨고 싶은 단계 (저장하지 않습니다) */
  wanted: TourStep[]
  /** 지금 떠 있는 단계 — 한 번에 하나뿐입니다 (저장하지 않습니다) */
  active: TourStep | null

  /** 그 단계의 조건이 맞았는가 · 더는 안 맞는가(화면이 비켰을 때) */
  want: (step: TourStep, on: boolean) => void
  finish: (step: TourStep) => void
  /** 지금 떠 있을 때만 끝냅니다 — 결과창을 닫는 것처럼 '봤다' 는 뜻이 그때만 있는 길 */
  finishIfActive: (step: TourStep) => void
  stop: () => void
  /** 헤더 '?' 판의 [안내 처음부터 다시 보기] */
  restart: () => void
}

function isReady(step: TourStep, done: readonly TourStep[]) {
  const rule = AFTER[step]
  if (!rule) return true
  const allDone = (rule.all ?? []).every((before) => done.includes(before))
  const anyDone = !rule.any || rule.any.some((before) => done.includes(before))
  return allDone && anyDone
}

/**
 * 지금 떠 있어야 할 단계를 고릅니다.
 *
 * 떠 있는 단계는 **끝나거나 조건이 풀릴 때까지 그대로 둡니다** — 차례가 앞선 단계의 조건이
 * 뒤늦게 맞아도 그 사이에 끼어들지 않습니다. 읽던 한 줄이 바뀌면 둘 다 못 읽습니다.
 */
export function pickActiveStep(
  state: Pick<TourState, 'active' | 'wanted' | 'done' | 'off'>,
): TourStep | null {
  if (state.off) return null
  const { active, wanted, done } = state
  if (active && wanted.includes(active) && !done.includes(active)) return active
  return (
    TOUR_STEPS.find(
      (step) =>
        wanted.includes(step) && !done.includes(step) && isReady(step, done),
    ) ?? null
  )
}

const INITIAL: TourProgress = { done: [], off: false }

const isTourStep = (value: unknown): value is TourStep =>
  typeof value === 'string' && (TOUR_STEPS as readonly string[]).includes(value)

/**
 * 메인 첫 방문 안내의 순서표. 단계마다 '이 화면에 처음 왔다' 를 아는 쪽(검색창 · 추천 결과 · 엔진)이
 * `want` 로 알리고, 여기서 **한 번에 하나만** 세웁니다. 헤더의 '?' 판이 처음부터 다시 걸 수 있어
 * 화면이 아니라 여기(shared)에 둡니다 — `graphicsStore` 와 같은 사정입니다.
 *
 * 끝낸 단계는 이 브라우저에 남깁니다. 비회원도 다음 방문에 같은 안내를 다시 보지 않게 합니다.
 */
export const useTourStore = create<TourState>()(
  persist(
    (set) => {
      const settle = (next: Partial<TourState>) =>
        set((state) => {
          const merged = { ...state, ...next }
          return { ...next, active: pickActiveStep(merged) }
        })

      return {
        ...INITIAL,
        wanted: [],
        active: null,

        want: (step, on) =>
          set((state) => {
            if (state.wanted.includes(step) === on) return state
            const wanted = on
              ? [...state.wanted, step]
              : state.wanted.filter((item) => item !== step)
            return { wanted, active: pickActiveStep({ ...state, wanted }) }
          }),
        finish: (step) =>
          set((state) => {
            if (state.done.includes(step)) return state
            const done = [...state.done, step]
            return { done, active: pickActiveStep({ ...state, done }) }
          }),
        finishIfActive: (step) =>
          set((state) => {
            if (state.active !== step) return state
            const done = [...state.done, step]
            return { done, active: pickActiveStep({ ...state, done }) }
          }),
        stop: () => settle({ off: true }),
        restart: () => settle({ ...INITIAL, active: null }),
      }
    },
    {
      name: 'hyanghae-tour',
      version: 1,
      partialize: ({ done, off }) => ({ done, off }),
      // 손으로 고친 저장소 값에 모르는 단계가 있으면 걸러 냅니다
      merge: (persisted, current) => {
        const saved = (persisted ?? {}) as Partial<TourProgress>
        return {
          ...current,
          done: Array.isArray(saved.done) ? saved.done.filter(isTourStep) : [],
          off: saved.off === true,
        }
      },
    },
  ),
)
