import { cleanup, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { DECK_MS } from '../components/ShelfDeck'

import { useTagSwing } from './useTagSwing'

/*
 * requestAnimationFrame · performance.now 를 손으로 돌립니다. frame() 한 번이 16ms 입니다.
 * jsdom 은 크기를 재면 전부 0 이라, 태그 셋이 모두 창 가운데(늦음 0 · 벌어짐 0)에 걸린 것으로 셉니다.
 */
let now = 0
let frames = new Map<number, FrameRequestCallback>()
let lastId = 0

beforeEach(() => {
  now = 0
  frames = new Map()
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
    lastId += 1
    frames.set(lastId, callback)
    return lastId
  })
  vi.stubGlobal('cancelAnimationFrame', (id: number) => {
    frames.delete(id)
  })
  vi.spyOn(performance, 'now').mockImplementation(() => now)
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

const frame = () => {
  now += 16
  const due = [...frames.values()]
  frames.clear()
  due.forEach((callback) => callback(now))
}

/** 태그 셋이 매달린 트랙 · 창 · 패널 자리를 만들어 훅에 넘깁니다 */
const setup = ({ measured = true } = {}) => {
  const viewport = document.createElement('section')
  const track = document.createElement('div')
  const hangers = Array.from({ length: 3 }, () => {
    const hanger = document.createElement('span')
    hanger.className = 'shelf-tag-hanger'
    track.append(hanger)
    return hanger
  })
  viewport.append(track)
  const panel = document.createElement('div')
  const { result } = renderHook(() =>
    useTagSwing(
      { current: measured ? track : null },
      { current: viewport },
      { current: panel },
    ),
  )
  return { swing: result.current, hangers, panel }
}

const liftOf = (hanger: HTMLElement) =>
  Number.parseFloat(hanger.style.getPropertyValue('--tag-lift'))

const bare = (hanger: HTMLElement) =>
  !hanger.hasAttribute('data-lift') &&
  hanger.style.getPropertyValue('--tag-lift') === '' &&
  hanger.style.getPropertyValue('--tag-lit') === ''

describe('useTagSwing — 바람(gust)', () => {
  it('떠날 때: 부는 동안 패널 자리에 data-gust, 태그에 들림 · 빛을 쓰고, 무대가 빠진 뒤 전부 뗀다', () => {
    const { swing, hangers, panel } = setup()
    swing.gust('leave')
    expect(panel.hasAttribute('data-gust')).toBe(true)

    let peak = 0
    let lit = 0
    while (now < DECK_MS) {
      frame()
      for (const hanger of hangers) {
        if (!hanger.hasAttribute('data-lift')) continue
        peak = Math.max(peak, liftOf(hanger))
        lit = Math.max(lit, Number(hanger.style.getPropertyValue('--tag-lit')))
      }
    }
    expect(peak).toBeGreaterThan(8)
    expect(peak).toBeLessThanOrEqual(26)
    expect(lit).toBeGreaterThan(0)
    expect(hangers.every((hanger) => hanger.hasAttribute('data-lift'))).toBe(
      true,
    )

    while (now < DECK_MS + 60 + 16) frame()
    expect(panel.hasAttribute('data-gust')).toBe(false)
    expect(hangers.every(bare)).toBe(true)
  })

  it('돌아올 때: 모든 태그가 가라앉으면 1.4초 안에 표시를 떼고, 이어서 루프도 끝난다', () => {
    const { swing, hangers, panel } = setup()
    swing.gust('arrive')

    let lifted = false
    while (panel.hasAttribute('data-gust') && now < 3000) {
      frame()
      if (hangers.some((hanger) => hanger.hasAttribute('data-lift'))) {
        lifted = true
      }
    }
    expect(lifted).toBe(true)
    expect(now).toBeLessThanOrEqual(1400)
    expect(hangers.every(bare)).toBe(true)

    for (let count = 0; frames.size > 0 && count < 100; count += 1) frame()
    expect(frames.size).toBe(0)
  })

  it('벽이 흐르며 돌던 루프가 바람을 이어 받는다', () => {
    const { swing, hangers, panel } = setup()
    swing.kick()
    frame()
    swing.gust('leave')
    expect(panel.hasAttribute('data-gust')).toBe(true)
    while (now < 250) frame()
    expect(hangers.some((hanger) => hanger.hasAttribute('data-lift'))).toBe(
      true,
    )
  })

  it('움직임을 줄이도록 설정했으면 불지 않는다', () => {
    vi.stubGlobal('matchMedia', (query: string) => ({
      matches: query.includes('reduced-motion'),
    }))
    const { swing, hangers, panel } = setup()
    swing.gust('leave')
    expect(frames.size).toBe(0)
    expect(panel.hasAttribute('data-gust')).toBe(false)
    expect(hangers.every(bare)).toBe(true)
  })

  it('벽을 그리기 전(트랙이 없음)에는 패널 자리에 data-gust 를 걸지 않는다', () => {
    const { swing, panel } = setup({ measured: false })
    swing.gust('arrive')
    expect(frames.size).toBe(0)
    expect(panel.hasAttribute('data-gust')).toBe(false)
  })
})
