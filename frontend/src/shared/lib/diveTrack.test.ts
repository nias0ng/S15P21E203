import { describe, expect, it } from 'vitest'

import {
  COVER_FROM,
  DIVE_MS,
  diveDuration,
  diveFrameAt,
  REDUCED_MS,
} from './diveTrack'

/**
 * 잠수 전환의 시계 (메인 3D → 진열대).
 *
 * 화면으로만 볼 수 있는 것(물색 · 카메라)은 여기서 안 봅니다. 대신 **두 판이 어긋나지 않는
 * 조건**만 못 박습니다 — 3D 진행도와 커튼이 같은 0 에서 시작해 같은 1 에서 끝나는가,
 * 커튼이 3D 보다 먼저 올라오지 않는가.
 */
describe('diveFrameAt', () => {
  it('시작에는 아무것도 안 덮는다', () => {
    const frame = diveFrameAt(0)
    expect(frame.k).toBe(0)
    expect(frame.cover).toBe(0)
    expect(frame.covered).toBe(false)
  })

  it('커튼은 3D 가 먼저 움직인 뒤에 차오른다', () => {
    // COVER_FROM 전에는 엔진만 움직인다 — 카메라가 내려가는 것이 먼저 보여야 한다
    expect(diveFrameAt(DIVE_MS * (COVER_FROM - 0.05)).cover).toBe(0)
    expect(diveFrameAt(DIVE_MS * (COVER_FROM + 0.05)).cover).toBeGreaterThan(0)
  })

  it('둘이 같은 끝에서 만난다 — 다 덮은 그 순간이 진행도 1 이다', () => {
    const frame = diveFrameAt(DIVE_MS)
    expect(frame.k).toBe(1)
    expect(frame.cover).toBe(1)
    expect(frame.covered).toBe(true)
  })

  it('시간이 더 흘러도 1 을 넘지 않는다', () => {
    const frame = diveFrameAt(DIVE_MS * 3)
    expect(frame.k).toBe(1)
    expect(frame.cover).toBe(1)
  })

  it('진행도도 커튼도 되돌아가지 않는다', () => {
    let k = -1
    let cover = -1
    for (let at = 0; at <= DIVE_MS; at += 25) {
      const frame = diveFrameAt(at)
      expect(frame.k).toBeGreaterThanOrEqual(k)
      expect(frame.cover).toBeGreaterThanOrEqual(cover)
      k = frame.k
      cover = frame.cover
    }
  })

  it('움직임 줄이기는 짧게 덮는다', () => {
    expect(diveDuration(false)).toBe(DIVE_MS)
    expect(diveDuration(true)).toBe(REDUCED_MS)
    // 짧아져도 규칙은 같다 — 끝에서 다 덮는다
    expect(diveFrameAt(REDUCED_MS, REDUCED_MS).cover).toBe(1)
  })
})
