import { beforeEach, describe, expect, it } from 'vitest'

import {
  pickActiveStep,
  TOUR_SPOTLIGHT,
  TOUR_STEPS,
  useTourStore,
  type TourStep,
} from './tourStore'

const reset = () =>
  useTourStore.setState({
    done: [],
    off: false,
    wanted: [],
    active: null,
    forced: null,
    touch: false,
    advanced: 0,
  })

const state = () => useTourStore.getState()

/** 항해 줄기에서 그 단계 앞의 것을 모두 끝냅니다 */
const SAILED: TourStep[] = ['sea', 'keys', 'buoy']

beforeEach(() => {
  localStorage.clear()
  reset()
})

describe('한 번에 하나', () => {
  it('조건이 맞은 단계가 서고, 끝내면 기다리던 다음 단계가 선다', () => {
    state().want('sea', true)
    state().want('results', true)
    expect(state().active).toBe('sea')

    state().finish('sea')
    expect(state().active).toBe('results')
  })

  it('떠 있는 단계는 차례가 앞선 단계가 뒤늦게 와도 그대로다', () => {
    state().want('results', true)
    state().want('sea', true)

    expect(state().active).toBe('results')
  })

  it('조건이 풀리면 접고, 다시 맞으면 다시 선다', () => {
    state().want('sea', true)
    state().want('sea', false)
    expect(state().active).toBeNull()

    state().want('sea', true)
    expect(state().active).toBe('sea')
  })

  it('끝낸 단계는 조건이 다시 맞아도 안 선다', () => {
    state().finish('sea')
    state().want('sea', true)

    expect(state().active).toBeNull()
  })
})

// 처음 온 사람이 바다를 눌러 배를 움직일 수 있다는 것을 못 찾았습니다 — 한 가지씩 차례로 해 보게 합니다
describe('항해 줄기 — 바다 → 방향키 → 부표 → 닮은 향수 → 느낌·상황', () => {
  const ALL: TourStep[] = ['sea', 'keys', 'buoy', 'similar', 'search']

  it('조건이 한꺼번에 맞아도 하나씩 차례대로 선다', () => {
    for (const step of ALL) state().want(step, true)

    for (const step of ALL) {
      expect(state().active).toBe(step)
      state().finish(step)
    }
    expect(state().active).toBeNull()
  })

  it('앞 단계를 다 끝내야 선다 — 부표를 먼저 눌러 본 사람도 바다 누르기부터 배운다', () => {
    state().finish('buoy')
    state().want('similar', true)
    state().want('search', true)
    expect(state().active).toBeNull()

    state().want('sea', true)
    expect(state().active).toBe('sea')
    state().finish('sea')
    // 방향키 단계는 그 화면이 알려야 섭니다 — 아직 아무것도 안 섭니다
    expect(state().active).toBeNull()

    state().finish('keys')
    expect(state().active).toBe('similar')
  })

  it('느낌·상황은 닮은 향수를 기다리지 않는다 — 부표 안내를 [×] 로 닫은 사람에게도 선다', () => {
    state().want('search', true)
    for (const step of SAILED) state().finish(step)

    expect(state().active).toBe('search')
  })

  it('닮은 향수가 같이 맞으면 느낌·상황보다 먼저 선다', () => {
    state().finish('sea')
    state().finish('keys')
    state().want('search', true)
    state().want('similar', true)
    expect(state().active).toBeNull()

    state().finish('buoy')
    expect(state().active).toBe('similar')
  })

  it('해역 · 추천 결과처럼 그 화면에서 서는 단계는 줄기를 기다리지 않는다', () => {
    state().want('zone', true)

    expect(state().active).toBe('zone')
  })
})

describe('손가락 기기', () => {
  it('방향키 단계를 건너뛰고 바다 다음에 부표가 선다', () => {
    state().setTouch(true)
    state().want('keys', true)
    state().want('buoy', true)
    state().want('sea', true)
    expect(state().active).toBe('sea')

    state().finish('sea')
    expect(state().active).toBe('buoy')
    expect(state().done).not.toContain('keys')
  })

  it('방향키 단계가 떠 있다가 손가락 기기로 바뀌면 접는다', () => {
    state().finish('sea')
    state().want('keys', true)
    expect(state().active).toBe('keys')

    state().setTouch(true)
    expect(state().active).toBeNull()
  })

  it('눌러 넘길 때도 방향키 단계를 건너뛴다', () => {
    state().setTouch(true)
    state().want('sea', true)
    state().next('sea')

    expect(state().forced).toBe('buoy')
    expect(state().active).toBe('buoy')
  })

  it('방향키가 있는 기기는 바다 다음에 방향키를 넘겨 세운다', () => {
    state().want('sea', true)
    state().next('sea')

    expect(state().active).toBe('keys')
  })
})

describe('앞 단계', () => {
  it('향해 일지는 부표를 알고 카드나 해역을 본 뒤에 선다', () => {
    const base = { active: null, off: false, wanted: ['log' as const] }

    expect(pickActiveStep({ ...base, done: ['sea', 'buoy'] })).toBeNull()
    expect(pickActiveStep({ ...base, done: ['sea', 'card'] })).toBeNull()
    expect(pickActiveStep({ ...base, done: ['sea', 'buoy', 'card'] })).toBe(
      'log',
    )
  })

  it('카드가 끝나면 미니맵이 먼저, 그다음 향해 일지가 선다', () => {
    for (const step of SAILED) state().finish(step)
    state().finish('search')
    state().want('log', true)
    state().want('minimap', true)
    expect(state().active).toBeNull()

    state().finish('card')
    expect(state().active).toBe('minimap')
    state().finish('minimap')
    expect(state().active).toBe('log')
  })

  it('부표를 눌러 카드가 먼저 떠도 닮은 향수 안내가 먼저 서고, 끝나면 카드 안내가 선다', () => {
    for (const step of SAILED) state().finish(step)
    state().want('card', true)
    expect(state().active).toBeNull()

    state().want('similar', true)
    expect(state().active).toBe('similar')

    state().finish('similar')
    expect(state().active).toBe('card')
  })

  it('해역 연출 중에 누른 카드는 해역 안내를 본 뒤에 선다', () => {
    const base = { active: null, off: false, wanted: ['card' as const] }

    expect(pickActiveStep({ ...base, done: [] })).toBeNull()
    expect(pickActiveStep({ ...base, done: ['zone'] })).toBe('card')
  })

  it('미니맵은 카드 · 해역 가운데 하나만 끝나도 선다', () => {
    const base = { active: null, off: false, wanted: ['minimap' as const] }

    expect(pickActiveStep({ ...base, done: [] })).toBeNull()
    expect(pickActiveStep({ ...base, done: ['zone'] })).toBe('minimap')
  })

  it('배는 미니맵 · 향해 일지가 둘 다 끝나야 선다', () => {
    const base = { active: null, off: false, wanted: ['boat' as const] }

    expect(pickActiveStep({ ...base, done: ['minimap'] })).toBeNull()
    expect(pickActiveStep({ ...base, done: ['minimap', 'log'] })).toBe('boat')
  })
})

// 그 행동을 하기 전에 안내부터 다 읽어 보고 싶은 사람이 있습니다 — 안내를 누르면 다음 안내로 넘어갑니다
describe('눌러 넘기기', () => {
  it('다음 안내가 제 조건 · 앞 단계와 상관없이 곧바로 선다', () => {
    state().want('sea', true)
    state().next('sea')

    expect(state().done).toEqual(['sea'])
    expect(state().active).toBe('keys')
  })

  // 3D 는 이 값이 바뀌는 것을 듣고 해역 연출을 닫습니다 — 그 행동을 해서 끝낸 것은 넘긴 것이 아닙니다
  it('넘길 때마다 advanced 가 하나씩 늘고, 끝내기 · [×] 는 세지 않는다', () => {
    state().want('sea', true)
    state().next('sea')
    state().finish('keys')
    state().next('buoy')

    expect(state().advanced).toBe(2)
  })

  it('항해 줄기를 눌러 넘기면 차례로 선다 — 닮은 향수는 그 판이 떠야 서서 건너뛴다', () => {
    state().want('sea', true)
    const seen: (TourStep | null)[] = []
    for (let i = 0; i < 4; i++) {
      seen.push(state().active)
      const active = state().active
      if (active) state().next(active)
    }

    expect(seen).toEqual(['sea', 'keys', 'buoy', 'search'])
    expect(state().active).toBe('minimap')
  })

  it('닮은 향수를 눌러 넘기면 느낌·상황이 선다', () => {
    for (const step of SAILED) state().finish(step)
    state().want('similar', true)
    state().next('similar')

    expect(state().active).toBe('search')
  })

  it('가리킬 창이 있어야 하는 카드 · 해역 · 추천 결과는 건너뛰고, 그 창이 뜨면 제 조건대로 선다', () => {
    state().next('search')
    expect(state().active).toBe('minimap')

    state().finish('minimap')
    state().finish('similar')
    state().want('card', true)
    expect(state().active).toBe('card')
  })

  it('넘겨 세운 안내도 [×] · 그 행동으로 끝나고, 마지막을 넘기면 아무것도 안 선다', () => {
    state().next('log')
    expect(state().active).toBe('boat')

    state().next('boat')
    expect(state().active).toBeNull()
    expect(state().forced).toBeNull()
  })

  it('[안내 그만 보기] 는 넘겨 세운 안내도 끈다', () => {
    state().next('sea')
    state().stop()

    expect(state().active).toBeNull()
  })
})

describe('끄기 · 다시 보기', () => {
  it('[안내 그만 보기] 뒤로는 아무것도 안 선다', () => {
    state().want('sea', true)
    state().stop()

    expect(state().active).toBeNull()
    state().want('results', true)
    expect(state().active).toBeNull()
  })

  it('처음부터 다시 보면 끝낸 단계 · 끄기를 풀고 첫 단계(바다)부터 다시 선다', () => {
    state().want('sea', true)
    state().want('buoy', true)
    for (const step of SAILED) state().finish(step)
    state().stop()

    state().restart()
    expect(state().done).toEqual([])
    expect(state().active).toBe('sea')
  })

  it('결과창을 닫는 길은 떠 있던 단계만 끝낸다', () => {
    state().finishIfActive('results')
    expect(state().done).toEqual([])

    state().want('results', true)
    state().finishIfActive('results')
    expect(state().done).toEqual(['results'])
  })
})

describe('이 브라우저에 남기기', () => {
  it('끝낸 단계 · 끄기만 남긴다', () => {
    state().want('sea', true)
    state().finish('sea')

    const saved = JSON.parse(localStorage.getItem('hyanghae-tour') ?? '{}')
    expect(saved.state).toEqual({ done: ['sea'], off: false })
  })

  it('걷은 단계는 읽을 때 버리고, [안내 그만 보기] 는 그대로 지킨다', async () => {
    localStorage.setItem(
      'hyanghae-tour',
      JSON.stringify({
        state: { done: ['welcome', 'buoy', 'search'], off: true },
        version: 1,
      }),
    )

    await useTourStore.persist.rehydrate()

    expect(state().done).toEqual(['buoy', 'search'])
    expect(state().off).toBe(true)
    state().want('sea', true)
    expect(state().active).toBeNull()
  })

  it('예전 안내를 다 본 사람에게는 새 단계만 선다', async () => {
    localStorage.setItem(
      'hyanghae-tour',
      JSON.stringify({
        state: { done: ['welcome', 'buoy', 'search', 'card'], off: false },
        version: 1,
      }),
    )

    await useTourStore.persist.rehydrate()

    state().want('sea', true)
    expect(state().active).toBe('sea')
    state().finish('sea')
    state().want('keys', true)
    expect(state().active).toBe('keys')
  })
})

// 설명하는 단계는 3D 를 멈추고 짙게, 3D 의 그것을 눌러 보는 단계는 옅게, 직접 해 보는 단계는 덮지 않습니다
describe('스포트라이트 세기', () => {
  it('모든 단계에 세기가 있다', () => {
    for (const step of TOUR_STEPS) {
      expect(['none', 'light', 'dim']).toContain(TOUR_SPOTLIGHT[step])
    }
  })

  it('정한 대로 나뉜다 — 설명은 dim · 부표와 닮은 향수는 light · 바다 · 방향키 · 해역은 none', () => {
    const by = (strength: string) =>
      TOUR_STEPS.filter((step) => TOUR_SPOTLIGHT[step] === strength)

    expect(by('dim')).toEqual([
      'search',
      'card',
      'minimap',
      'log',
      'boat',
      'results',
    ])
    expect(by('light')).toEqual(['buoy', 'similar'])
    expect(by('none')).toEqual(['sea', 'keys', 'zone'])
  })
})
