import { act, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { useMediaQuery } from './useMediaQuery'

/** 창 폭 하나를 흉내 내는 matchMedia. `resize` 로 문턱을 넘깁니다 */
function fakeMatchMedia(initial: boolean) {
  let matches = initial
  const listeners = new Set<() => void>()

  const matchMedia = vi.fn(
    (media: string) =>
      ({
        get matches() {
          return matches
        },
        media,
        addEventListener: (_: string, listener: () => void) =>
          listeners.add(listener),
        removeEventListener: (_: string, listener: () => void) =>
          listeners.delete(listener),
      }) as unknown as MediaQueryList,
  )

  const resize = (next: boolean) => {
    matches = next
    listeners.forEach((listener) => listener())
  }

  return { matchMedia, resize, listeners }
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('useMediaQuery', () => {
  it('첫 렌더에서 바로 지금 값을 읽는다', () => {
    const { matchMedia } = fakeMatchMedia(true)
    vi.stubGlobal('matchMedia', matchMedia)

    const { result } = renderHook(() => useMediaQuery('(max-width: 1024px)'))

    expect(result.current).toBe(true)
    expect(matchMedia).toHaveBeenCalledWith('(max-width: 1024px)')
  })

  it('창이 문턱을 넘으면 다시 그린다', () => {
    const fake = fakeMatchMedia(false)
    vi.stubGlobal('matchMedia', fake.matchMedia)

    const { result } = renderHook(() => useMediaQuery('(width >= 64rem)'))
    expect(result.current).toBe(false)

    act(() => fake.resize(true))

    expect(result.current).toBe(true)
  })

  it('사라지면 듣기를 멈춘다', () => {
    const fake = fakeMatchMedia(false)
    vi.stubGlobal('matchMedia', fake.matchMedia)

    const { unmount } = renderHook(() => useMediaQuery('(width >= 64rem)'))
    expect(fake.listeners.size).toBe(1)

    unmount()

    expect(fake.listeners.size).toBe(0)
  })

  it('matchMedia 가 없으면 던지지 않고 fallback 을 쓴다', () => {
    vi.stubGlobal('matchMedia', undefined)

    expect(
      renderHook(() => useMediaQuery('(width >= 64rem)')).result.current,
    ).toBe(false)
    expect(
      renderHook(() => useMediaQuery('(width >= 64rem)', true)).result.current,
    ).toBe(true)
  })
})
