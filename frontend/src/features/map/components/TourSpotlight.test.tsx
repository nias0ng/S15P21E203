import { act, render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useTourStore, type TourStep } from '@/shared/store/tourStore'
import { TourTip } from '@/shared/ui/TourTip'

import { setTourAnchorSource, type TourAnchor } from '../lib/tourAnchor'

import { TourSpotlight } from './TourSpotlight'

/*
  jsdom 은 자리를 재지 않습니다(모든 상자가 0) — 안내 종이 · 가리킨 것의 상자를 정해 둡니다.
  rAF 도 손으로 한 장씩 넘깁니다. 짚은 자리의 맨 위(`elementsFromPoint`)도 없어 종이 안이면 종이로 답합니다.
*/
const TIP = { x: 100, y: 300, w: 200, h: 60 }
const TARGET = { x: 100, y: 100, w: 240, h: 120 }
/** 종이가 이 높이까지만 보입니다 — 잘린 채 펼쳐지는 동안을 흉내 냅니다 */
let shownTo = Infinity

const rect = ({ x, y, w, h }: typeof TIP) =>
  ({
    x,
    y,
    left: x,
    top: y,
    width: w,
    height: h,
    right: x + w,
    bottom: y + h,
    toJSON: () => ({}),
  }) as DOMRect

let frames: FrameRequestCallback[] = []
const nextFrame = () =>
  act(() => {
    const run = frames
    frames = []
    for (const callback of run) callback(0)
  })

const freeze = vi.fn()
let anchor: TourAnchor | null = null

beforeEach(() => {
  localStorage.clear()
  useTourStore.setState({ done: [], off: false, wanted: [], active: null })
  frames = []
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
    frames.push(callback)
    return frames.length
  })
  vi.stubGlobal('cancelAnimationFrame', () => {})
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(
    function (this: Element) {
      if (this.matches('[data-tour-tip]')) return rect(TIP)
      if (this.matches('[data-tour-target]')) return rect(TARGET)
      if (this.matches('dialog')) return rect({ x: 0, y: 0, w: 1024, h: 768 })
      return rect({ x: 0, y: 0, w: 0, h: 0 })
    },
  )
  shownTo = Infinity
  document.elementsFromPoint = (x, y) => {
    const tip = document.querySelector('[data-tour-tip]')
    const onTip =
      x >= TIP.x && x <= TIP.x + TIP.w && y >= TIP.y && y <= TIP.y + TIP.h
    return tip && onTip && y <= shownTo ? [tip] : []
  }
  freeze.mockReset()
  anchor = { ...TARGET, side: 1, hole: null }
  setTourAnchorSource({ watch: () => {}, read: () => anchor, freeze })
})
afterEach(() => {
  Reflect.deleteProperty(document, 'elementsFromPoint')
  setTourAnchorSource(null)
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

const start = (step: TourStep) => useTourStore.setState({ active: step })

function Tip() {
  return (
    <TourTip
      data-tour-tip=""
      onClose={() => {}}
      onNext={() => {}}
      onStopAll={() => {}}
    >
      안내
    </TourTip>
  )
}

function Screen({ children = <Tip /> }: { children?: ReactNode }) {
  return (
    <>
      <button type="button">3D</button>
      {children}
      <TourSpotlight />
    </>
  )
}

const mask = () =>
  document.querySelector<HTMLElement>('[data-tour-spotlight]') as HTMLElement
const maskShown = () => mask().dataset.shown === 'true'
const maskPath = () => mask().querySelector('path') as SVGPathElement

describe('TourSpotlight', () => {
  it('직접 해 보는 단계(바다)에는 덮지 않는다', () => {
    start('sea')
    render(<Screen />)
    nextFrame()
    nextFrame()

    expect(maskShown()).toBe(false)
    expect(freeze).not.toHaveBeenCalled()
  })

  it('설명하는 단계(카드)는 80% 로 덮고 3D 를 멈추며, 단계가 바뀌거나 화면을 떠나면 되살린다', () => {
    start('card')
    const { unmount } = render(<Screen />)
    nextFrame()

    expect(maskShown()).toBe(true)
    expect(maskPath()).toHaveAttribute('fill-opacity', '0.8')
    expect(maskPath().style.pointerEvents).toBe('auto')
    expect(freeze.mock.calls).toEqual([[true]])

    act(() => start('minimap'))
    expect(freeze.mock.calls).toEqual([[true], [false]])

    nextFrame()
    expect(freeze.mock.calls).toEqual([[true], [false], [true]])

    unmount()
    expect(freeze.mock.calls).toEqual([[true], [false], [true], [false]])
  })

  it('안내가 한두 장 숨으면 막만 걷혔다 돌아오고, 3D 는 멈춘 채 · 초점은 안내에 둔다', () => {
    start('card')
    render(<Screen />)
    screen.getByRole('button', { name: '3D' }).focus()
    nextFrame()

    anchor = null
    nextFrame()
    expect(maskShown()).toBe(false)
    expect(maskPath().style.pointerEvents).toBe('none')
    expect(freeze.mock.calls).toEqual([[true]])
    // 숨은 단추는 초점이 빠집니다 (jsdom 은 visibility 로 빼지 않아 손으로 뺍니다)
    act(() => (document.activeElement as HTMLElement).blur())

    anchor = { ...TARGET, side: 1, hole: null }
    nextFrame()
    expect(maskShown()).toBe(true)
    expect(freeze.mock.calls).toEqual([[true]])
    expect(screen.getByRole('status')).toHaveFocus()
  })

  it('오래 숨으면 3D 를 되살리고, 같은 단계에서 돌아와도 다시 멈추지 않는다', () => {
    let now = 1000
    vi.spyOn(performance, 'now').mockImplementation(() => now)
    start('card')
    render(<Screen />)
    nextFrame()

    anchor = null
    nextFrame()
    now += 500
    nextFrame()
    expect(maskShown()).toBe(false)
    expect(freeze.mock.calls).toEqual([[true], [false]])

    anchor = { ...TARGET, side: 1, hole: null }
    nextFrame()
    expect(maskShown()).toBe(true)
    expect(freeze.mock.calls).toEqual([[true], [false]])
  })

  it('부표는 40% 로 옅게 덮고 3D 는 그대로 둔다', () => {
    start('buoy')
    render(<Screen />)
    nextFrame()

    expect(maskShown()).toBe(true)
    expect(maskPath()).toHaveAttribute('fill-opacity', '0.4')
    expect(freeze).not.toHaveBeenCalled()
  })

  it('안내 종이가 없으면 덮지 않고 누름도 통과시킨다', () => {
    start('card')
    render(<Screen>{null}</Screen>)
    nextFrame()

    expect(maskShown()).toBe(false)
    expect(maskPath().style.pointerEvents).not.toBe('auto')
    expect(freeze).not.toHaveBeenCalled()
  })

  it('안내가 자리를 잡기 전(숨어 있는 동안)에는 덮지 않는다', () => {
    start('card')
    render(
      <Screen>
        <div style={{ visibility: 'hidden' }}>
          <Tip />
        </div>
      </Screen>,
    )
    nextFrame()

    expect(maskShown()).toBe(false)
  })

  it('안내가 다 보이기 전(잘린 채 펼쳐지는 동안)에는 덮지 않는다', () => {
    shownTo = TIP.y + 20
    start('card')
    render(<Screen />)
    nextFrame()
    expect(maskShown()).toBe(false)
    expect(freeze).not.toHaveBeenCalled()

    shownTo = Infinity
    nextFrame()
    expect(maskShown()).toBe(true)
  })

  it('엔진이 준 밝힐 상자는 여백 없이 밝히고, 안내와 겹치면 감싸지 않고 안내 쪽을 물린다', () => {
    // 부표의 구멍(이름표 · 몸통 + 엔진의 여백)이 그 밑의 안내 위끝에 30px 걸칩니다
    anchor = {
      ...TARGET,
      side: 1,
      hole: { x: 100, y: 250, w: 200, h: 80 },
    }
    start('buoy')
    render(<Screen />)
    nextFrame()

    const d = maskPath().getAttribute('d') ?? ''
    // 화면 전체 · 안내 위로 물린 구멍(100, 250 · 높이 50) · 안내 종이 — 둘을 감싼 상자 하나가 아닙니다
    expect(d.match(/M/g)).toHaveLength(3)
    expect(d).toContain('M112 250H288')
    expect(d).toContain('V288')
  })

  it('닮은 향수 안내가 카드에 붙으면(밝힐 상자가 없으면) 덮지 않는다 — 누를 12개가 막 밑에 깔립니다', () => {
    start('similar')
    render(<Screen />)
    nextFrame()
    expect(maskShown()).toBe(false)

    anchor = { ...TARGET, side: 1, hole: TARGET }
    nextFrame()
    expect(maskShown()).toBe(true)
  })

  it('popover 가 없는 브라우저에서는 결과창 안의 안내를 덮지 않는다', () => {
    start('results')
    render(
      <Screen>
        <dialog open>
          <ul data-tour-target="results" />
          <Tip />
        </dialog>
      </Screen>,
    )
    nextFrame()

    expect(maskShown()).toBe(false)
  })

  it('가리킬 것을 못 쟀으면 덮지 않는다 — 엔진이 자리를 모르거나 앱 쪽 표시가 없을 때', () => {
    anchor = null
    start('card')
    render(<Screen />)
    nextFrame()
    expect(maskShown()).toBe(false)

    act(() => start('log'))
    nextFrame()
    expect(maskShown()).toBe(false)
  })

  it('앱 쪽 단계는 표시(`data-tour-target`)를 단 것을 밝힌다', () => {
    start('log')
    render(
      <Screen>
        <div data-tour-target="log">향해 일지</div>
        <Tip />
      </Screen>,
    )
    nextFrame()

    expect(maskShown()).toBe(true)
    // 화면 전체 · 가리킨 것 · 안내 종이 — 세 겹입니다
    expect(maskPath().getAttribute('d')?.match(/M/g)).toHaveLength(3)
  })

  // 단추에 주면 누르지 않아도 [다음] 에 초점 테가 섰습니다 — 테가 없는 종이가 받고, Tab 하면 그 안의 단추로 갑니다
  it('덮는 동안 키보드 초점은 안내 종이로 가고, 걷히면 원래 자리로 돌아온다', () => {
    start('card')
    render(<Screen />)
    screen.getByRole('button', { name: '3D' }).focus()
    nextFrame()

    expect(screen.getByRole('status')).toHaveFocus()
    expect(screen.getByRole('button', { name: /다음/ })).not.toHaveFocus()

    act(() => useTourStore.setState({ active: null }))
    expect(screen.getByRole('button', { name: '3D' })).toHaveFocus()
  })

  it('검색 안내는 초점을 옮기지 않는다 — 입력칸에 적던 말이 끊기지 않게', () => {
    start('search')
    render(
      <Screen>
        <input aria-label="느낌·상황" data-tour-target="search" />
        <Tip />
      </Screen>,
    )
    screen.getByRole('textbox', { name: '느낌·상황' }).focus()
    nextFrame()

    expect(maskShown()).toBe(true)
    expect(screen.getByRole('textbox', { name: '느낌·상황' })).toHaveFocus()
  })
})
