import type { MapPerfume, VoyageLogEntry } from '../types'

import type { PerfumeIdIndex } from './perfumeIdAt'

/**
 * DB 향수 번호 → 3D 지도의 향수 (엔진 데이터 한 줄).
 *
 * 왜 필요한가: 향해 일지 API 는 향수를 번호와 DB 원명(`perfumes.name`, 대개 영문)으로만 줍니다.
 * 같은 화면의 3D 는 엔진 데이터의 한글 이름 · 브랜드 · 계열을 쓰므로 일지도 그 값으로 맞춥니다 —
 * 방금 누른 카드 · 부표와 일지의 이름이 같아야 어느 향수인지 바로 읽힙니다.
 *
 * 엔진 데이터에는 DB 번호가 없어 **좌표로** 잇습니다([자세히 보기] 와 같은 다리 · `perfumeIdAt`).
 * 일지에 남는 향수는 모두 지도 위의 향수라(지도에서 [자세히 보기] 를 누른 것 · 취향 테스트의 출발점)
 * 이 200개 안에서 다 찾힙니다.
 *
 * NOTE: DB 에도 한글 이름(`name_ko`)이 있지만 엔진 데이터와 표기가 다른 향수가 있습니다.
 *   여기서는 3D 카드·부표와 표기를 맞추기 위해 엔진 쪽을 씁니다.
 *
 * @param index DB 향수 번호 색인 (`buildPerfumeIdIndex` — `GET /api/v1/map` 의 좌표)
 * @param perfumes 엔진 데이터의 지도 향수 (`loadMapPerfumes`)
 * @returns 찾은 향수만 담은 번호 → 향수. 같은 번호가 두 번 나오면 먼저 온 것을 지킵니다
 */
export function buildMapPerfumeLookup(
  index: PerfumeIdIndex,
  perfumes: readonly MapPerfume[],
): Map<number, MapPerfume> {
  const lookup = new Map<number, MapPerfume>()
  for (const perfume of perfumes) {
    const perfumeId = index.at(perfume.mx, perfume.my)
    if (perfumeId !== null && !lookup.has(perfumeId)) {
      lookup.set(perfumeId, perfume)
    }
  }
  return lookup
}

/**
 * 일지 줄의 향수를 지도 데이터로 채웁니다 — 이름은 3D 부표 위의 짧은 한글 이름으로 바꾸고,
 * 줄이지 않은 이름 · 브랜드 · 계열을 곁들입니다.
 *
 * @param entries 향해 일지 줄 (API 순서 그대로)
 * @param lookup `buildMapPerfumeLookup` 의 결과
 * @returns 새 줄. 받은 줄은 건드리지 않습니다(쿼리 캐시의 값입니다). 지도에서 못 찾은 향수는 API 값 그대로입니다
 */
export function withMapPerfumes(
  entries: readonly VoyageLogEntry[],
  lookup: ReadonlyMap<number, MapPerfume>,
): VoyageLogEntry[] {
  return entries.map((entry) => ({
    ...entry,
    visited: entry.visited.map((visited) => {
      const perfume = lookup.get(visited.perfumeId)
      if (!perfume) return visited
      return {
        perfumeId: visited.perfumeId,
        name: perfume.label,
        fullName: perfume.name,
        brand: perfume.brand,
        family: perfume.family,
      }
    }),
  }))
}
