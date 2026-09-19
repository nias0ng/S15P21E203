import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { layoutWall } from '../lib'
import type { ShelfItem } from '../types'

import { useBottlePreload } from './useBottlePreload'

const item = (id: number): ShelfItem => ({
  shelfItemId: id,
  perfumeId: id,
  name: `향수 ${id}`,
  brand: '브랜드',
  thumbnailUrl: `/bottles/${id}.png`,
  category: 'OWNED',
})

/*
 * 가리지 않는 칸 일곱 · 두 칸 기둥에 병 [5, 17] — 벽감 칸이 2~6 · 9~25 입니다.
 * 첫 화면은 칸 0 ~ 9(창에 걸친 아홉 칸과 오른쪽 끝 이웃)입니다.
 */
const LAYOUT = layoutWall(
  [
    {
      category: 'OWNED',
      label: '보유 중',
      items: Array.from({ length: 5 }, (_, at) => item(at + 1)),
    },
    {
      category: 'TRIED',
      label: '시향해 봄',
      items: Array.from({ length: 17 }, (_, at) => item(at + 6)),
    },
  ],
  7,
  2,
)
const FIRST_SCREEN_TO = 9

/** DisplayCase 와 같은 모양의 병 칸들. 사진의 alt 에 칸 순서를 적어 둡니다 */
const buildTrack = () => {
  const track = document.createElement('div')
  for (const section of LAYOUT.sections) {
    section.items.forEach((_, at) => {
      const slot = section.start + at
      const button = document.createElement('button')
      button.className = 'shelf-slot'
      const box = document.createElement('span')
      box.setAttribute('data-photo', '')
      const img = document.createElement('img')
      img.className = 'shelf-bottle-img'
      img.alt = String(slot)
      img.setAttribute(
        'fetchpriority',
        slot <= FIRST_SCREEN_TO ? 'high' : 'low',
      )
      box.append(img)
      button.append(box)
      track.append(button)
    })
  }
  document.body.append(track)
  return track
}

/** 풀기를 시작한 칸 순서와, 끝내 줄 함수 */
let started: string[] = []
let finish: Map<string, (ok: boolean) => void> = new Map()

beforeEach(() => {
  started = []
  finish = new Map()
  vi.useFakeTimers()
  // jsdom 에는 img.decode() 가 없습니다. 칸마다 끝내는 때를 테스트가 정합니다
  Object.defineProperty(HTMLImageElement.prototype, 'decode', {
    configurable: true,
    value(this: HTMLImageElement) {
      started.push(this.alt)
      return new Promise<void>((resolve, reject) => {
        finish.set(this.alt, (ok) => (ok ? resolve() : reject(new Error())))
      })
    },
  })
})

afterEach(() => {
  vi.useRealTimers()
  Reflect.deleteProperty(HTMLImageElement.prototype, 'decode')
  document.body.replaceChildren()
})

/** 풀기가 끝난 뒤의 이어 달리기(Promise 콜백)를 흘려 보냅니다 */
const flush = async () => {
  for (let count = 0; count < 5; count += 1) await Promise.resolve()
}

const boxOf = (track: HTMLElement, slot: number) =>
  track.querySelector(`img[alt="${slot}"]`)?.parentElement

const preload = (track: HTMLElement, start = 0) => {
  const ref = { current: track }
  return renderHook(
    ({ at }: { at: number }) =>
      useBottlePreload(ref, LAYOUT.sections, at, 7, true),
    { initialProps: { at: start } },
  )
}

describe('useBottlePreload', () => {
  it('한가해지면 첫 화면부터 창 가운데에서 가까운 순서(오른쪽 · 왼쪽 번갈아)로 두 장씩 푼다', async () => {
    const track = buildTrack()
    preload(track)
    // 그리는 동안에는 풀지 않습니다
    expect(started).toEqual([])

    vi.runAllTimers()
    // 가운데 3.5 — 칸 3 · 4 가 먼저, 동시에 둘까지
    expect(started).toEqual(['3', '4'])
    expect(boxOf(track, 3)).not.toHaveAttribute('data-ready')

    finish.get('3')?.(true)
    await flush()
    expect(boxOf(track, 3)).toHaveAttribute('data-ready')
    expect(boxOf(track, 4)).not.toHaveAttribute('data-ready')
    expect(started).toEqual(['3', '4', '2'])

    for (let count = 0; count < 22 && finish.size > 0; count += 1) {
      for (const [slot, done] of finish) {
        finish.delete(slot)
        done(true)
      }
      await flush()
    }
    // 첫 화면(2~6 · 9) 뒤로 칸 10, 11, … 이 가까운 순서로 이어집니다
    expect(started.slice(0, 8)).toEqual([
      '3',
      '4',
      '2',
      '5',
      '6',
      '9',
      '10',
      '11',
    ])
    expect(started).toHaveLength(22)
    expect(
      track.querySelectorAll('[data-photo]:not([data-ready])'),
    ).toHaveLength(0)
  })

  it('벽이 다른 칸에 서면 남은 줄을 새 가운데 기준으로 다시 세운다', async () => {
    const track = buildTrack()
    const { rerender } = preload(track)
    vi.runAllTimers()
    // 칸 19 에 섰습니다 — 가운데 22.5
    rerender({ at: 19 })
    for (let count = 0; count < 22 && finish.size > 0; count += 1) {
      for (const [slot, done] of finish) {
        finish.delete(slot)
        done(true)
      }
      await flush()
    }
    // 이미 풀기 시작한 3 · 4 뒤로, 남은 첫 화면도 새 가운데에서 가까운 순서입니다
    expect(started.slice(0, 6)).toEqual(['3', '4', '9', '6', '5', '2'])
    expect(started.slice(6, 12)).toEqual(['22', '23', '21', '24', '20', '25'])
  })

  it('이미 받아 둔 사진은 그리자마자 드러내고, 받기에 실패한 사진도 풀기가 끝나면 드러낸다', async () => {
    const track = buildTrack()
    const cached = track.querySelector<HTMLImageElement>('img[alt="12"]')
    if (cached) {
      Object.defineProperty(cached, 'complete', { value: true })
      Object.defineProperty(cached, 'naturalWidth', { value: 400 })
    }
    preload(track)
    expect(boxOf(track, 12)).toHaveAttribute('data-ready')

    vi.runAllTimers()
    finish.get('3')?.(false)
    await flush()
    expect(boxOf(track, 3)).toHaveAttribute('data-ready')
  })

  it('받는 중인 사진은 건너뛰고 받아 둔 사진부터 풀며, 받기가 끝나면 그때 줄에 세운다', async () => {
    const track = buildTrack()
    const imgs = [...track.querySelectorAll<HTMLImageElement>('img')]
    // 칸 2 만 다 받았고 나머지는 받는 중입니다
    for (const img of imgs) {
      if (img.alt === '2') continue
      Object.defineProperty(img, 'complete', {
        configurable: true,
        value: false,
      })
    }
    preload(track)
    vi.runAllTimers()
    // 가운데 3 · 4 는 받는 중이라 자리를 쥐지 않고, 받아 둔 2 를 먼저 풉니다
    expect(started).toEqual(['2'])
    finish.get('2')?.(true)
    await flush()
    expect(boxOf(track, 2)).toHaveAttribute('data-ready')

    const loaded = (slot: string) => {
      const img = imgs.find((each) => each.alt === slot)
      if (!img) throw new Error(`칸 ${slot} 이 없습니다`)
      Object.defineProperty(img, 'complete', {
        configurable: true,
        value: true,
      })
      img.dispatchEvent(new Event('load'))
    }
    // 받기가 끝나는 대로 곧바로 풉니다 — 첫 화면 밖 칸 10 이 먼저 받아지면 그것부터
    loaded('10')
    expect(started).toEqual(['2', '10'])
    loaded('4')
    expect(started).toEqual(['2', '10', '4'])
  })

  it('한가해지기 전에 벽이 사라지면 풀지 않는다', () => {
    const track = buildTrack()
    const { unmount } = preload(track)
    unmount()
    vi.runAllTimers()
    expect(started).toEqual([])
  })

  /*
   * ───────── 첫 화면 병이 다 섰다는 신호 (2026-09-19) ─────────
   *
   * 잠수 커튼이 이 신호에 걷힙니다 (`ShelfWall` 이 `useDiveReady` 로 잇습니다). 여태 커튼은
   * **목록**이 칠해지면 걷혔고, 그래서 걷고 난 뒤에 병이 한 장씩 뒤늦게 떠올랐습니다.
   *
   * ⚠ 이 훅이 돌려주는 값은 React 상태라 `act` 로 감싸야 읽힙니다. 위쪽 테스트들이 `act` 없이
   *   도는 것은 DOM 속성(data-ready)만 보기 때문입니다 — 그쪽은 예열기가 직접 씁니다.
   */
  const firstScreenSlots = (track: HTMLElement) =>
    [
      ...track.querySelectorAll<HTMLImageElement>('img[fetchpriority="high"]'),
    ].map((img) => Number(img.alt))

  const allFirstReady = (track: HTMLElement) =>
    firstScreenSlots(track).every((slot) =>
      boxOf(track, slot)?.hasAttribute('data-ready'),
    )

  /** 지금 풀리기를 기다리는 것을 전부 끝냅니다 */
  const finishAll = async () => {
    for (const [slot, done] of finish) {
      finish.delete(slot)
      done(true)
    }
    await flush()
  }

  it('첫 화면 병이 다 드러나야 알린다 — 나머지 병은 안 기다린다', async () => {
    const track = buildTrack()
    const { result } = preload(track)
    expect(firstScreenSlots(track)).toHaveLength(6)

    await act(async () => {
      vi.runAllTimers()
    })
    expect(result.current).toBe(false)

    /*
      라운드마다 (다 섰는가 · 알렸는가)를 적어 두고 끝나고 한꺼번에 봅니다 — 루프 안에서
      조건을 걸고 expect 하면 조건이 한 번도 안 맞았을 때 아무것도 안 본 채로 통과합니다.
    */
    const rounds: { stood: boolean; told: boolean }[] = []
    for (let count = 0; count < 30 && !allFirstReady(track); count += 1) {
      await act(finishAll)
      rounds.push({ stood: allFirstReady(track), told: result.current })
    }
    // 다 서기 전에 알린 라운드가 하나도 없습니다
    expect(rounds.filter((round) => !round.stood && round.told)).toEqual([])
    expect(rounds.length).toBeGreaterThan(1)

    expect(allFirstReady(track)).toBe(true)
    expect(result.current).toBe(true)
    // 첫 화면 밖 병은 아직 안 드러났는데도 알렸습니다 — 그것까지 기다리면 커튼이 상한까지 섭니다
    expect(
      track.querySelectorAll('[data-photo]:not([data-ready])').length,
    ).toBeGreaterThan(0)
  })

  it('첫 화면 사진이 이미 다 받아져 있으면 그 자리에서 알린다', async () => {
    const track = buildTrack()
    // 10분 안에 다시 들어온 경우입니다 — 풀 것이 없어 한가해지기를 기다릴 까닭도 없습니다
    for (const slot of firstScreenSlots(track)) {
      const img = track.querySelector<HTMLImageElement>(`img[alt="${slot}"]`)
      if (!img) continue
      Object.defineProperty(img, 'complete', { value: true })
      Object.defineProperty(img, 'naturalWidth', { value: 400 })
    }
    const { result } = preload(track)
    expect(result.current).toBe(true)
    // 아직 아무것도 풀지 않았습니다
    expect(started).toEqual([])
  })

  it('사진이 한 장도 없는 진열대는 곧바로 알린다', () => {
    const track = buildTrack()
    // 사진이 없는 병은 DisplayCase 가 img 를 안 그립니다 — 기다릴 것이 없습니다
    for (const img of track.querySelectorAll('img')) img.remove()
    const { result } = preload(track)
    expect(result.current).toBe(true)
  })
})
