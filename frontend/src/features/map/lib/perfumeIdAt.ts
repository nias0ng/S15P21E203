import type { MapPerfumePoint } from '../types'

/**
 * 엔진이 넘긴 좌표로 **DB 향수 번호**를 찾습니다 (MAP-24 향해 일지).
 *
 * 왜 필요한가: 향해 일지에 "이 향수를 봤다" 를 남기려면 서버에 `perfumeId`(DB 번호)를 보내야
 * 하는데, 3D 엔진 데이터에는 그 번호가 **한 건도 없습니다** — 엔진이 가진 것은
 * `fragrantica_id` 뿐입니다(`landing/src/perfumes-data.js` · `host.js` 의 perfumeRef 주석).
 *
 * 이을 수 있는 것은 **좌표**입니다. `GET /api/v1/map` 의 `x`·`y` 는 `perfume_map_points` 의
 * `map_x`·`map_y` 를 그대로 주고, 엔진의 `mx`·`my` 도 같은 CSV 에서 나왔습니다 — **같은 0~1
 * 공간**입니다 (엔진 불변식 21). 카드 이미지를 같은 방법으로 200/200 맞춘 전례가 있습니다(불변식 24).
 *
 * ⚠️ 짝짓는 곳은 **이 파일 하나**입니다. 부르는 쪽에서 좌표를 비교하기 시작하면 반올림 자리가
 * 갈라져 어떤 향수는 찾히고 어떤 향수는 안 찾히는 일이 생깁니다.
 */

/**
 * 좌표를 키로 만들 때 남기는 소수 자리.
 *
 * ⚠️⚠️ **정확히 같기를 기대하지 않습니다.** 두 값은 같은 CSV 에서 왔지만 한쪽은 JSON 을 거쳐
 * `double` 로, 다른 쪽은 자바스크립트 리터럴로 들어옵니다.
 *
 * 실측(엔진 데이터 200개) — **가장 가까운 두 향수의 거리 0.002293** (르 뱅쾨르 / 폴로 블루) ·
 * 소수 6자리로 반올림했을 때 **같은 칸에 들어가는 쌍 0건**. 6자리면 안전합니다.
 */
export const KEY_DIGITS = 6

/**
 * 키가 어긋났을 때 받아 줄 **최대 거리** (정규화 단위).
 *
 * ⚠️ 0.0005 는 위 최소 간격(0.002293)의 **5분의 1** 입니다. 이보다 크게 잡으면 붙어 있는 두
 * 향수 사이에서 엉뚱한 번호를 돌려줄 수 있습니다 — **못 찾는 것보다 잘못 찾는 것이 나쁩니다**
 * (일지에 안 본 향수가 남습니다).
 */
export const NEAR_LIMIT = 0.0005

const keyOf = (x: number, y: number) =>
  `${x.toFixed(KEY_DIGITS)},${y.toFixed(KEY_DIGITS)}`

export interface PerfumeIdIndex {
  /** 좌표로 DB 향수 번호를 찾습니다. 못 찾으면 null 입니다 */
  at: (x: number, y: number) => number | null
  /** 색인에 든 향수 수 — 검산용입니다 */
  size: number
}

/**
 * 좌표 → DB 향수 번호 색인을 만듭니다.
 *
 * 먼저 반올림한 키로 찾고, 없으면 `NEAR_LIMIT` 안의 가장 가까운 점을 받습니다. 200개짜리
 * 목록이라 훑어도 싸고, 부르는 때가 카드의 단추를 누른 순간뿐입니다.
 */
export function buildPerfumeIdIndex(
  points: readonly MapPerfumePoint[],
): PerfumeIdIndex {
  const exact = new Map<string, number>()
  for (const point of points) {
    // ⚠️ 같은 칸에 둘이 들어오면 **먼저 온 것을 지킵니다.** 덮어쓰면 목록 순서에 따라 답이
    // 바뀌어, 같은 좌표를 두 번 물었을 때 다른 번호가 나올 수 있습니다
    const key = keyOf(point.x, point.y)
    if (!exact.has(key)) exact.set(key, point.perfumeId)
  }

  return {
    size: exact.size,
    at(x, y) {
      if (!Number.isFinite(x) || !Number.isFinite(y)) return null

      const hit = exact.get(keyOf(x, y))
      if (hit !== undefined) return hit

      let best: number | null = null
      let bestDistance = NEAR_LIMIT
      for (const point of points) {
        const distance = Math.hypot(point.x - x, point.y - y)
        if (distance <= bestDistance) {
          bestDistance = distance
          best = point.perfumeId
        }
      }
      return best
    },
  }
}
