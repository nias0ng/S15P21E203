import { describe, expect, it } from 'vitest'

import { PERFUMES } from '@landing/perfumes-data'

import { buildPerfumeIdIndex, KEY_DIGITS, NEAR_LIMIT } from './perfumeIdAt'

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

/**
 * 색인은 **시드 데이터가 두 가지를 지킨다는 전제** 위에 서 있습니다. 위 시험들은 색인의 행동을
 * 재지만, 전제가 깨지면 행동이 맞아도 **답이 틀립니다** — 좌표가 겹치는 두 향수가 있으면
 * 목록 순서에 따라 엉뚱한 번호가 나갑니다 (리뷰 지적, 2026-09-23).
 *
 * 그래서 여기서는 **데이터 자체**를 잽니다. 재는 대상은 엔진 목록(`landing/perfumes-data.js`)인데,
 * `GET /api/v1/map` 의 좌표와 **같은 CSV**(`perfume_map_points.csv` · md5 동일)에서 나오므로
 * 이 시험이 곧 API 쪽 전제이기도 합니다.
 *
 * NOTE: CSV 를 다시 만들어 좌표가 촘촘해지면 여기서 먼저 깨집니다. 그때 할 일은 시험을 고치는
 * 것이 아니라 `lib/perfumeIdAt.ts` 의 `KEY_DIGITS` 를 늘리고 `NEAR_LIMIT` 을 줄이는 것입니다.
 */
describe('지도 향수 200개의 좌표 (색인의 전제)', () => {
  it('반올림한 칸이 겹치는 향수가 없다 — 겹치면 먼저 온 것만 찾힌다', () => {
    const seen = new Map<string, string>()
    const collisions: string[] = []
    for (const p of PERFUMES) {
      const key = `${p.mx.toFixed(KEY_DIGITS)},${p.my.toFixed(KEY_DIGITS)}`
      const first = seen.get(key)
      if (first === undefined) seen.set(key, p.name)
      else collisions.push(`${key} → ${first} / ${p.name}`)
    }

    expect(collisions).toEqual([])
    expect(seen.size).toBe(PERFUMES.length)
  })

  it('가장 가까운 두 향수가 허용 반경보다 멀다 — 가까우면 이웃을 잘못 집는다', () => {
    let min = Infinity
    let pair = ''
    for (const [i, a] of PERFUMES.entries()) {
      for (let j = i + 1; j < PERFUMES.length; j++) {
        const b = PERFUMES[j]
        if (!b) continue
        const d = Math.hypot(a.mx - b.mx, a.my - b.my)
        if (d < min) {
          min = d
          pair = `${a.name} / ${b.name}`
        }
      }
    }

    // 실측 2026-09-23 : 0.002293 (르 뱅쾨르 / 폴로 블루) — 허용 반경의 4.6 배
    expect(min, `가장 가까운 쌍 : ${pair}`).toBeGreaterThan(NEAR_LIMIT)
  })
})
