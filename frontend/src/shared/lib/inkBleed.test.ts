import { describe, expect, it } from 'vitest'

import { bleedReach, makeBleedGrain, paintBleed } from './inkBleed'

/**
 * 잉크처럼 스며드는 덮개 (선실로 들어가기의 구름 커튼).
 *
 * 모양은 화면으로 봐야 합니다. 여기서는 **커튼으로서 지켜야 할 것**만 못 박습니다 — 시작에는 아무것도
 * 안 가리고, 끝에서는 빈틈없이 덮고, 한 번 젖은 자리는 다시 마르지 않고, 시작점에서부터 번진다.
 */
const COLS = 48
const ROWS = 27
const ASPECT = 16 / 9
const CENTER = { x: 0.5, y: 0.5 }

const alphas = (bleed: number, origin = CENTER, seed = 7) => {
  const reach = bleedReach(
    makeBleedGrain(COLS, ROWS, seed),
    COLS,
    ROWS,
    origin,
    ASPECT,
  )
  const rgba = new Uint8ClampedArray(COLS * ROWS * 4)
  paintBleed(reach, rgba, bleed)
  return Array.from({ length: COLS * ROWS }, (_, at) => rgba[at * 4 + 3] ?? 0)
}

describe('makeBleedGrain', () => {
  it('결은 0~1 을 다 쓴다 — 가운데로 몰리면 앞선이 안 흔들려 다시 원이 된다', () => {
    const grain = makeBleedGrain(COLS, ROWS, 3)
    // 칸이 Float32 라 끝이 정확히 0 · 1 로 떨어지지는 않습니다
    expect(Math.min(...grain)).toBeCloseTo(0, 6)
    expect(Math.max(...grain)).toBeCloseTo(1, 6)
  })

  it('씨앗이 같으면 같은 결, 다르면 다른 결이다', () => {
    expect(makeBleedGrain(COLS, ROWS, 11)).toEqual(
      makeBleedGrain(COLS, ROWS, 11),
    )
    expect(makeBleedGrain(COLS, ROWS, 11)).not.toEqual(
      makeBleedGrain(COLS, ROWS, 12),
    )
  })
})

describe('paintBleed', () => {
  it('시작에는 아무것도 안 가린다', () => {
    expect(Math.max(...alphas(0))).toBe(0)
  })

  it('끝에서는 빈틈없이 다 짙다 — 덮인 채로 화면이 바뀐다', () => {
    for (const seed of [1, 2, 3]) {
      expect(Math.min(...alphas(1, CENTER, seed))).toBe(255)
    }
  })

  it('한 번 젖은 자리는 다시 마르지 않는다', () => {
    let before = alphas(0)
    for (let bleed = 0.05; bleed <= 1; bleed += 0.05) {
      const now = alphas(bleed)
      now.forEach((alpha, at) =>
        expect(alpha).toBeGreaterThanOrEqual(before[at] ?? 0),
      )
      before = now
    }
  })

  it('시작점에서부터 번진다 — 시작점이 가장 먼 모서리보다 먼저 짙어진다', () => {
    // 시작점을 왼쪽 위 가까이에 둡니다 — 가장 먼 곳은 오른쪽 아래 모서리입니다
    const origin = { x: 0.2, y: 0.25 }
    const early = alphas(0.3, origin)
    const atOrigin =
      early[Math.floor(0.25 * ROWS) * COLS + Math.floor(0.2 * COLS)]
    const farCorner = early[ROWS * COLS - 1]
    expect(atOrigin).toBeGreaterThan(0)
    expect(farCorner).toBe(0)
  })

  it('앞선이 들쭉날쭉하다 — 시작점에서 같은 거리의 칸들이 같이 젖지 않는다', () => {
    /*
      원판이 아니라는 것을 수로 봅니다. 시작점에서 거의 같은 거리에 있는 칸들을 모아, 번지는 도중에
      그 알파가 서로 크게 다른가를 봅니다. 원이면 같은 거리는 같은 알파입니다.
    */
    const mid = alphas(0.45)
    const ring: number[] = []
    for (let row = 0; row < ROWS; row += 1) {
      for (let col = 0; col < COLS; col += 1) {
        const dx = ((col + 0.5) / COLS - 0.5) * ASPECT
        const dy = (row + 0.5) / ROWS - 0.5
        const d = Math.hypot(dx, dy) / Math.hypot(ASPECT / 2, 0.5)
        if (Math.abs(d - 0.55) < 0.03) ring.push(mid[row * COLS + col] ?? 0)
      }
    }
    expect(Math.max(...ring) - Math.min(...ring)).toBeGreaterThan(80)
  })
})
