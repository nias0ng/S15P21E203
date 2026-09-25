import { cleanup, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useShelfFlow } from './useShelfFlow'

/** 1920 x 1080 의 칸 폭 */
const PITCH = 1460 / 7

/*
 * requestAnimationFrame · performance.now 를 손으로 돌립니다. frame() 한 번이 16ms 입니다.
 */
let now = 0
let frames = new Map<number, FrameRequestCallback>()
let lastId = 0

/*
 * 프레임마다 벽이 선 자리(칸). 훅은 위치를 트랙의 transform 에만 적어서, 한 프레임이 돌 때마다
 * 거기서 읽어 모읍니다.
 */
let track: HTMLElement | null = null
let positions: number[] = []

const positionOf = (element: HTMLElement) => {
  const x = /translate3d\((-?[\d.]+)px/.exec(element.style.transform)?.[1]
  return -Number(x ?? 0) / PITCH
}

beforeEach(() => {
  now = 0
  frames = new Map()
  track = null
  positions = []
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
  // 흉내 낸 requestAnimationFrame 을 되돌리기 전에 훅을 내립니다(dispose 가 cancelAnimationFrame 을 부름)
  cleanup()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

const frame = () => {
  now += 16
  const due = [...frames.values()]
  frames.clear()
  due.forEach((callback) => callback(now))
  if (due.length > 0 && track) positions.push(positionOf(track))
}

/** 벽이 설 때까지 프레임을 돌리고 걸린 시간(ms)을 돌려줍니다 */
const settle = () => {
  const started = now
  for (let count = 0; frames.size > 0 && count < 300; count += 1) frame()
  return now - started
}

const setup = ({ pageScrollAtEnds = false } = {}) => {
  const viewport = document.createElement('section')
  track = document.createElement('div')
  const refs = {
    viewport: { current: viewport },
    track: { current: track },
  }
  const onMoveStart = vi.fn()
  const onSettle = vi.fn<(start: number) => void>()
  const { result } = renderHook(() =>
    useShelfFlow({
      ...refs,
      pitch: PITCH,
      max: 26,
      clear: 7,
      pageScrollAtEnds,
      onMoveStart,
      onSettle,
    }),
  )
  const wheel = (deltaY: number, init: WheelEventInit = {}) => {
    const event = new WheelEvent('wheel', { deltaY, cancelable: true, ...init })
    viewport.dispatchEvent(event)
    return event
  }
  return {
    viewport,
    flow: result.current,
    wheel,
    onMoveStart,
    onSettle,
  }
}

describe('useShelfFlow 휠 — 한 번 = 한 칸', () => {
  it('휠 한 번(100)이면 다음 칸 1 에 붙는다', () => {
    const { wheel, flow, onMoveStart, onSettle } = setup()
    expect(wheel(100).defaultPrevented).toBe(true)
    expect(onMoveStart).toHaveBeenCalledTimes(1)
    expect(flow.destination()).toBe(1)
    settle()
    expect(onSettle).toHaveBeenCalledTimes(1)
    expect(onSettle).toHaveBeenLastCalledWith(1)
  })

  it('120 · 66.67 · 150 · −100 도 한 번에 한 칸씩 간다', () => {
    const { wheel, flow, onSettle } = setup()
    flow.go(3, true)
    const steps = [
      [120, 4],
      [66.67, 5],
      [150, 6],
      [-100, 5],
    ] as const
    for (const [delta, expected] of steps) {
      wheel(delta)
      settle()
      expect(onSettle).toHaveBeenLastCalledWith(expected)
    }
  })

  it('흐르는 중에 같은 쪽으로 다섯 번 굴리면 목적지에 쌓여 한 번에 5 에 선다', () => {
    const { wheel, onSettle } = setup()
    for (let at = 0; at < 5; at += 1) {
      wheel(100)
      frame()
      frame()
    }
    settle()
    expect(onSettle).toHaveBeenCalledTimes(1)
    expect(onSettle).toHaveBeenLastCalledWith(5)
  })

  it('한꺼번에 스무 번 굴려도 가리지 않는 칸 수(일곱)보다 앞서 쌓지 않는다', () => {
    const { wheel, onSettle } = setup()
    for (let at = 0; at < 20; at += 1) wheel(100)
    settle()
    expect(onSettle).toHaveBeenLastCalledWith(7)
  })

  it('반대로 굴리면 흐르던 벽이 몇 프레임 안에 돌아선다', () => {
    const { wheel, flow, onSettle } = setup()
    flow.go(3, true)
    for (let at = 0; at < 3; at += 1) {
      wheel(100)
      frame()
    }
    frame()
    frame()
    const turnedAt = positions.length
    wheel(-100)
    // 칸 폭 208px 에서 초당 스물두 칸 남짓으로 흐르던 속도를 이어받아, 네 프레임(64ms) 안에 돌아섭니다
    for (let at = 0; at < 4; at += 1) frame()
    const after = positions.slice(turnedAt - 1)
    const back = after.some(
      (position, at) => at > 0 && position < (after[at - 1] ?? position),
    )
    expect(back).toBe(true)
    settle()
    const rest = onSettle.mock.lastCall?.[0] ?? Infinity
    expect(rest).toBeLessThan(6)
    expect(Number.isInteger(rest)).toBe(true)
  })

  it('한 칸은 넘지 않고 끝을 천천히 들어가 1초 안에 서고, 한 프레임에 90px 넘게 건너뛰지 않는다', () => {
    const { wheel, flow } = setup()
    flow.go(3, true)
    wheel(100)
    expect(settle()).toBeLessThanOrEqual(1000)
    expect((Math.max(...positions) - 4) * PITCH).toBeLessThanOrEqual(0.5)
    // 남은 한 칸의 10% 는 자석에 끌려가듯 천천히 — 스무 프레임(0.32초) 넘게 걸립니다
    const close = positions.findIndex((position) => position >= 3.9)
    expect(positions.length - close).toBeGreaterThan(20)
    const jumps = positions.map((position, at) =>
      Math.abs(position - (positions[at - 1] ?? 3)),
    )
    expect(Math.max(...jumps) * PITCH).toBeLessThan(90)
  })

  it('벽 끝에서 더 굴리면 움직이지 않고, 움직이기 시작했다고 알리지도 않는다', () => {
    const { wheel, flow, onMoveStart, onSettle } = setup()
    // 한 장 배치는 페이지가 스크롤되지 않아 휠을 늘 받습니다
    expect(wheel(-100).defaultPrevented).toBe(true)
    expect(onMoveStart).not.toHaveBeenCalled()
    expect(frames.size).toBe(0)

    flow.go(26, true)
    onSettle.mockClear()
    wheel(100)
    expect(onMoveStart).not.toHaveBeenCalled()
    expect(onSettle).not.toHaveBeenCalled()
    expect(frames.size).toBe(0)
  })

  it('쌓는 배치: 벽 끝에 서 있으면 그 너머로 굴린 휠을 페이지 스크롤로 넘긴다', () => {
    const { wheel, flow } = setup({ pageScrollAtEnds: true })
    expect(wheel(-100).defaultPrevented).toBe(false)
    expect(wheel(100).defaultPrevented).toBe(true)
    settle()
    flow.go(26, true)
    expect(wheel(100).defaultPrevented).toBe(false)
    expect(wheel(-100).defaultPrevented).toBe(true)
  })

  it('ctrl + 휠(확대)은 브라우저에 맡긴다', () => {
    const { wheel, onMoveStart } = setup()
    expect(wheel(100, { ctrlKey: true }).defaultPrevented).toBe(false)
    expect(onMoveStart).not.toHaveBeenCalled()
  })

  it('칩으로 옮기던 중에 같은 쪽으로 굴리면 흐르던 속도를 이어받는다', () => {
    const { wheel, flow, onSettle } = setup()
    flow.go(5)
    for (let at = 0; at < 10; at += 1) frame()
    const stride = () => (positions.at(-1) ?? 0) - (positions.at(-2) ?? 0)
    const gliding = stride()
    expect(gliding).toBeGreaterThan(0)
    wheel(100)
    frame()
    expect(stride()).toBeGreaterThanOrEqual(gliding)
    settle()
    expect(onSettle).toHaveBeenLastCalledWith(6)
  })

  it('움직임을 줄인 사용자에게는 휠 한 번에 한 칸씩 바로 옮긴다', () => {
    vi.stubGlobal('matchMedia', (query: string) => ({
      matches: query.includes('reduce'),
      addEventListener: () => {},
      removeEventListener: () => {},
    }))
    const { wheel, onMoveStart, onSettle } = setup()
    wheel(100)
    expect(onSettle).toHaveBeenLastCalledWith(1)
    wheel(100)
    expect(onSettle).toHaveBeenLastCalledWith(2)
    expect(onMoveStart).not.toHaveBeenCalled()
    expect(frames.size).toBe(0)
  })
})

describe('useShelfFlow 마우스 올리기', () => {
  it('마우스를 움직이면 진열대에 data-pointer 를 걸고, 휠을 굴리면 뗀다', () => {
    const { wheel, viewport } = setup()
    viewport.dispatchEvent(
      new PointerEvent('pointermove', { pointerType: 'mouse' }),
    )
    expect(viewport).toHaveAttribute('data-pointer')
    wheel(100)
    expect(viewport).not.toHaveAttribute('data-pointer')
    // 손가락은 마우스 올리기가 없습니다
    viewport.dispatchEvent(
      new PointerEvent('pointermove', { pointerType: 'touch' }),
    )
    expect(viewport).not.toHaveAttribute('data-pointer')
  })
})

describe('useShelfFlow 옮기기', () => {
  it('소수 칸으로 보내면 가까운 칸에, 벽 끝 너머로 보내면 벽 끝에 선다', () => {
    const { flow, onSettle } = setup()
    flow.go(7.4)
    settle()
    expect(onSettle).toHaveBeenLastCalledWith(7)
    flow.go(40)
    settle()
    expect(onSettle).toHaveBeenLastCalledWith(26)
    flow.go(-3)
    settle()
    expect(onSettle).toHaveBeenLastCalledWith(0)
  })
})
