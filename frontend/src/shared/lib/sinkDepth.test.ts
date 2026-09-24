import { describe, expect, it } from 'vitest'

import { sinkDepth } from '@/shared/lib/sinkDepth'

describe('sinkDepth', () => {
  it('맨 위에서는 가라앉지 않았다', () => {
    expect(sinkDepth(0, 800, 0.5)).toBe(0)
  })

  it('정한 거리만큼 내리면 절반, 두 배면 3/4 만큼 가라앉는다', () => {
    expect(sinkDepth(400, 800, 0.5)).toBeCloseTo(0.5)
    expect(sinkDepth(800, 800, 0.5)).toBeCloseTo(0.75)
  })

  it('맨 위에서 튕겨 음수가 되어도 0 으로 본다', () => {
    expect(sinkDepth(-60, 800, 0.5)).toBe(0)
  })

  it('끝없이 내려도 1 을 넘지 않고, 내릴수록 깊어진다', () => {
    const steps = [0, 200, 800, 3200, 12800].map((y) => sinkDepth(y, 800, 0.5))

    for (let at = 1; at < steps.length; at += 1) {
      expect(steps[at]).toBeGreaterThan(steps[at - 1] ?? 0)
    }
    expect(sinkDepth(10_000_000, 800, 0.5)).toBeLessThanOrEqual(1)
  })
})
