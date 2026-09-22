import { describe, expect, it } from 'vitest'

import { buildPerfumeIdIndex } from './perfumeIdAt'

/**
 * 좌표로 DB 향수 번호를 찾는 색인 (MAP-24).
 *
 * ⚠️ 가장 중요한 것은 **잘못 찾지 않는 것**입니다 — 못 찾으면 일지 한 줄이 빠질 뿐이지만,
 * 잘못 찾으면 보지도 않은 향수가 일지에 남습니다.
 */
describe('buildPerfumeIdIndex', () => {
  const points = [
    { perfumeId: 11, x: 0.123456, y: 0.654321 },
    { perfumeId: 22, x: 0.5, y: 0.5 },
    { perfumeId: 33, x: 0.9, y: 0.1 },
  ]

  it('같은 좌표를 그대로 찾는다', () => {
    const index = buildPerfumeIdIndex(points)

    expect(index.at(0.123456, 0.654321)).toBe(11)
    expect(index.at(0.5, 0.5)).toBe(22)
  })

  it('소수 끝자리가 흔들려도 찾는다 — 같은 값이 JSON 과 JS 리터럴로 따로 들어온다', () => {
    const index = buildPerfumeIdIndex(points)

    expect(index.at(0.1234561, 0.6543209)).toBe(11)
  })

  it('멀리 떨어진 좌표는 찾지 않는다 — 잘못 찾느니 안 찾는다', () => {
    const index = buildPerfumeIdIndex(points)

    expect(index.at(0.2, 0.7)).toBeNull()
    // 허용 반경(0.0005)의 바로 바깥
    expect(index.at(0.5 + 0.002, 0.5)).toBeNull()
  })

  it('좌표가 숫자가 아니면 찾지 않는다', () => {
    const index = buildPerfumeIdIndex(points)

    expect(index.at(Number.NaN, 0.5)).toBeNull()
    expect(index.at(0.5, Number.POSITIVE_INFINITY)).toBeNull()
  })

  it('같은 칸에 둘이 있으면 먼저 온 것을 지킨다 — 물을 때마다 답이 바뀌면 안 된다', () => {
    const index = buildPerfumeIdIndex([
      { perfumeId: 1, x: 0.25, y: 0.25 },
      { perfumeId: 2, x: 0.25, y: 0.25 },
    ])

    expect(index.at(0.25, 0.25)).toBe(1)
    expect(index.at(0.25, 0.25)).toBe(1)
  })

  it('빈 목록이어도 터지지 않는다 — 지도 API 가 아직 안 왔을 때다', () => {
    const index = buildPerfumeIdIndex([])

    expect(index.size).toBe(0)
    expect(index.at(0.5, 0.5)).toBeNull()
  })
})
