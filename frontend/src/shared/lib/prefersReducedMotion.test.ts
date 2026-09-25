import { afterEach, describe, expect, it, vi } from 'vitest'

import { prefersReducedMotion } from './prefersReducedMotion'

const matchMediaReturning = (matches: boolean) =>
  vi.fn((query: string) => ({ matches, media: query }) as MediaQueryList)

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('prefersReducedMotion', () => {
  it('움직임 줄이기를 켰으면 true', () => {
    const matchMedia = matchMediaReturning(true)
    vi.stubGlobal('matchMedia', matchMedia)

    expect(prefersReducedMotion()).toBe(true)
    expect(matchMedia).toHaveBeenCalledWith('(prefers-reduced-motion: reduce)')
  })

  it('켜지 않았으면 false', () => {
    vi.stubGlobal('matchMedia', matchMediaReturning(false))

    expect(prefersReducedMotion()).toBe(false)
  })

  it('matchMedia 가 없는 곳에서는 던지지 않고 false', () => {
    vi.stubGlobal('matchMedia', undefined)

    expect(prefersReducedMotion()).toBe(false)
  })
})
