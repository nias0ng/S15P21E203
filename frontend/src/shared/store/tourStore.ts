import { create } from 'zustand'
import { persist } from 'zustand/middleware'

/**
 * 메인(3D 향 지도) 첫 방문 안내의 단계. 차례가 곧 **둘이 같이 뜨고 싶을 때 먼저 서는 쪽**입니다.
 *
 * 앞 다섯은 항해를 가르치는 한 줄기입니다 — 처음 온 사람이 바다를 눌러 배를 움직일 수 있다는 것을 못 찾아
 * "이동이 안 된다 · 항해를 못 한다" 고 했습니다(지인 피드백). 그래서 한 가지씩 직접 해 보게 합니다.
 *   sea      배 옆 — 이곳이 무엇인가 · 바다를 눌러 배를 움직여 보라 (그렇게 떠나면 끝납니다)
 *   keys     배 옆 — 방향키로 몰아 보라 (방향키가 있는 기기에서만 · 몰면 끝납니다)
 *   buoy     부표 — 눌러 보라 (엔진이 부표 곁에 그립니다 · 카드가 열리면 끝납니다)
 *   similar  떠오른 12개 가운데 하나 — 닮은 향수를 눌러 견줘 보라 (누르거나 그 판이 닫히면 끝납니다)
 *   search   검색창 아래 — '느낌·상황' 에 원하는 느낌 · 상황을 적어 보라 (첫 검색으로 끝납니다)
 *
 * 그 뒤는 그 화면에 처음 왔을 때 서는 단계입니다.
 *   card     첫 향수 카드 — 단추 셋의 차이
 *   zone     첫 해역 — 해역의 뜻 · 나가는 법
 *   minimap  미니맵 · 탐색 %
 *   log      향해 일지에 첫 기록이 생겼을 때
 *   boat     배 · 선실 · 진열대
 *   results  첫 추천 결과 — 카드를 누르면 이유가 펼쳐진다
 */
export const TOUR_STEPS = [
  'sea',
  'keys',
  'buoy',
  'similar',
  'search',
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
 *
 * 항해 줄기(sea → keys → buoy → similar · search)는 앞의 것을 **모두** 끝내야 섭니다 — 부표를 먼저 눌러 본 사람도
 * 바다 누르기부터 차례로 배웁니다. 이 기기에 없는 단계(`KEYS_ONLY`)는 끝낸 것으로 칩니다.
 * NOTE: search 는 similar 를 기다리지 않습니다 — similar 는 부표를 눌러야만 서서, [×] 로 부표 안내를 닫은 사람에게는
 *   영영 안 섭니다. 둘이 같이 맞으면 차례(similar 가 앞)대로 섭니다.
 */
const AFTER: Partial<Record<TourStep, { all?: TourStep[]; any?: TourStep[] }>> =
  {
    keys: { all: ['sea'] },
    buoy: { all: ['sea', 'keys'] },
    similar: { all: ['sea', 'keys', 'buoy'] },
    search: { all: ['sea', 'keys', 'buoy'] },
    // 부표를 누르면 카드가 먼저 서고 12개는 조금 늦게 떠올라, 차례만으로는 카드 안내가 닮은 향수 안내의 자리를 차지합니다.
    //   그래서 카드는 닮은 향수를 본 뒤에 섭니다. 해역 연출 중에 누른 카드는 12개가 안 떠서 해역 안내를 본 것으로 대신합니다
    card: { any: ['similar', 'zone'] },
    // 엔진은 배가 처음 든 해역도 알려 와(첫 기록) 들어오자마자 조건이 맞습니다 — 표의 차례(미니맵 → 일지 → 배)대로
    //   부표를 알고 카드나 해역을 한 번 본 뒤에 섭니다
    log: { all: ['buoy'], any: ['card', 'zone'] },
    minimap: { any: ['card', 'zone'] },
    boat: { all: ['minimap', 'log'] },
  }

/**
 * 안내를 눌러 **다음으로 넘길 때** 곧바로 세울 수 있는 단계 — 가리킬 것(배 · 부표 · 검색창 · 미니맵 · 향해 일지)이
 * 늘 화면에 있습니다. 닮은 향수 · 카드 · 해역 · 추천 결과는 그 판이 떠 있어야 가리킬 수 있어 넘기며 건너뛰고,
 * 그 판이 처음 뜰 때 제 조건대로 섭니다.
 */
const STANDALONE: readonly TourStep[] = [
  'sea',
  'keys',
  'buoy',
  'search',
  'minimap',
  'log',
  'boat',
]

/** 방향키가 있는 기기에서만 서는 단계 — 손가락 기기(`touch`)에서는 안 서고 끝낸 것으로 칩니다 */
const KEYS_ONLY: readonly TourStep[] = ['keys']

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
  /**
   * 안내를 눌러 넘긴 다음 단계 — 제 조건이 안 맞아도 끝날 때까지 섭니다 (저장하지 않습니다).
   * 넘긴 사람은 그 행동을 하기 전에 먼저 다 읽어 보고 싶은 것입니다.
   */
  forced: TourStep | null
  /**
   * 손가락 기기인가 — 방향키가 없어 `KEYS_ONLY` 단계를 건너뜁니다 (저장하지 않습니다).
   * 메인 화면이 `(pointer: coarse)` 로 알립니다 — 태블릿에 키보드를 끼우듯 바뀔 수 있어 그때마다 다시 받습니다.
   */
  touch: boolean

  /** 그 단계의 조건이 맞았는가 · 더는 안 맞는가(화면이 비켰을 때) */
  want: (step: TourStep, on: boolean) => void
  finish: (step: TourStep) => void
  /**
   * 안내를 눌렀습니다 — 이 단계를 끝내고 다음 단계(`STANDALONE` 가운데 이 기기에 있는 남은 첫째)를 곧바로 세웁니다
   */
  next: (step: TourStep) => void
  /** 지금 떠 있을 때만 끝냅니다 — 결과창을 닫는 것처럼 '봤다' 는 뜻이 그때만 있는 길 */
  finishIfActive: (step: TourStep) => void
  setTouch: (touch: boolean) => void
  stop: () => void
  /** 헤더 '?' 판의 [안내 처음부터 다시 보기] */
  restart: () => void
}

/** 이 기기에 없는 단계인가 — 손가락 기기의 방향키 */
const isAbsent = (step: TourStep, touch: boolean) =>
  touch && KEYS_ONLY.includes(step)

function isReady(step: TourStep, done: readonly TourStep[], touch: boolean) {
  const rule = AFTER[step]
  if (!rule) return true
  const passed = (before: TourStep) =>
    done.includes(before) || isAbsent(before, touch)
  const allDone = (rule.all ?? []).every(passed)
  const anyDone = !rule.any || rule.any.some(passed)
  return allDone && anyDone
}

/**
 * 지금 떠 있어야 할 단계를 고릅니다. 눌러 넘긴 단계(`forced`)가 있으면 그것이 먼저입니다.
 *
 * 떠 있는 단계는 **끝나거나 조건이 풀릴 때까지 그대로 둡니다** — 차례가 앞선 단계의 조건이
 * 뒤늦게 맞아도 그 사이에 끼어들지 않습니다. 읽던 한 줄이 바뀌면 둘 다 못 읽습니다.
 */
export function pickActiveStep(
  state: Pick<TourState, 'active' | 'wanted' | 'done' | 'off'> & {
    forced?: TourStep | null
    touch?: boolean
  },
): TourStep | null {
  if (state.off) return null
  const { active, wanted, done, forced, touch = false } = state
  const open = (step: TourStep) =>
    !done.includes(step) && !isAbsent(step, touch)
  if (forced && open(forced)) return forced
  if (active && wanted.includes(active) && open(active)) return active
  return (
    TOUR_STEPS.find(
      (step) =>
        wanted.includes(step) && open(step) && isReady(step, done, touch),
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
 * NOTE: 단계를 걷거나 이름을 바꾸면 저장소에 남은 모르는 이름은 읽을 때 버리고, 새로 더한 단계는 끝낸 적이 없는
 *   것으로 섭니다 — 예전 안내를 다 본 사람에게는 새 단계만 섭니다. [안내 그만 보기](`off`)는 그대로 지킵니다.
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
        forced: null,
        touch: false,

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
            const forced = state.forced === step ? null : state.forced
            return {
              done,
              forced,
              active: pickActiveStep({ ...state, done, forced }),
            }
          }),
        next: (step) =>
          set((state) => {
            const done = state.done.includes(step)
              ? state.done
              : [...state.done, step]
            const after = TOUR_STEPS.slice(TOUR_STEPS.indexOf(step) + 1)
            const forced =
              after.find(
                (later) =>
                  STANDALONE.includes(later) &&
                  !done.includes(later) &&
                  !isAbsent(later, state.touch),
              ) ?? null
            return {
              done,
              forced,
              active: pickActiveStep({ ...state, done, forced }),
            }
          }),
        finishIfActive: (step) =>
          set((state) => {
            if (state.active !== step) return state
            const done = [...state.done, step]
            const forced = state.forced === step ? null : state.forced
            return {
              done,
              forced,
              active: pickActiveStep({ ...state, done, forced }),
            }
          }),
        setTouch: (touch) =>
          set((state) =>
            state.touch === touch
              ? state
              : { touch, active: pickActiveStep({ ...state, touch }) },
          ),
        stop: () => settle({ off: true, forced: null }),
        restart: () => settle({ ...INITIAL, active: null, forced: null }),
      }
    },
    {
      name: 'hyanghae-tour',
      version: 1,
      partialize: ({ done, off }) => ({ done, off }),
      // 손으로 고친 저장소 값 · 걷은 단계처럼 모르는 단계가 있으면 걸러 냅니다
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
