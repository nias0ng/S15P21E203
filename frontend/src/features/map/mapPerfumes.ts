import { toScentFamilyKey } from '@/shared/config/scentFamilies'

import type { MapPerfume } from './types'

/**
 * 3D 지도에 떠 있는 향수 200개 안에서 찾기 (메인 검색의 **일반 검색** 쪽).
 *
 * 왜 백엔드 향수 검색(`features/perfume` 의 `searchPerfumes`)이 아닌가: 메인의
 * 일반 검색은 **지금 이 지도에 있는 향수**를 찾는 일입니다. 전체 향수를 뒤지면
 * 결과를 눌러도 지도에 없는 향수라 배가 갈 곳이 없습니다. 전체 검색은 A09 화면이
 * 따로 합니다.
 */

/**
 * 엔진 데이터는 **필요할 때 한 번만** 받습니다 (88KB).
 *
 * 메인에 들어온 사람이 다 검색하지는 않으므로 첫 화면 번들에 넣지 않습니다.
 * `import()` 라 vite 가 따로 묶고, 두 번째 검색부터는 이 약속을 그대로 씁니다 —
 * 모듈 캐시가 있어 실제로 두 번 받지는 않지만, 변환(200개 map)까지 다시 하지
 * 않으려고 약속 자체를 들고 있습니다.
 */
let loading: Promise<MapPerfume[]> | null = null

export function loadMapPerfumes(): Promise<MapPerfume[]> {
  loading ??= import('@landing/perfumes-data').then(({ PERFUMES }) =>
    PERFUMES.map((perfume): MapPerfume => ({
      fragranticaId: perfume.id,
      // 한글이 비어 있는 행이 있습니다 (koBasis 가 안 붙은 향수) — 그 자리는 원명으로 둡니다
      name: perfume.nameKo || perfume.name,
      label: perfume.labelKo || perfume.nameKo || perfume.name,
      brand: perfume.brandKo || perfume.brand,
      nameEn: perfume.name,
      brandEn: perfume.brand,
      family: toScentFamilyKey(perfume.family),
      rank: perfume.rank,
      mx: perfume.mx,
      my: perfume.my,
    })),
  )

  return loading
}

/** 한 번에 보여 줄 수 있는 결과 수. 모달이 스크롤 없이 담는 양보다 조금 많습니다 */
export const MAP_SEARCH_LIMIT = 20

/**
 * 이름 · 브랜드로 거릅니다 — 한글과 영문 원명을 **둘 다** 봅니다.
 *
 * 사람이 "조말론" 처럼 붙여 치거나 "JoMalone" 으로 칠 수 있어서 공백을 지우고
 * 견줍니다. 형태소 분석이나 초성 검색은 없습니다 — 200개짜리 목록이라 부분 일치로
 * 충분하고, 라이브러리를 하나 붙일 만한 일이 아닙니다.
 *
 * 순서는 **지도 순위**(rank) 그대로입니다. 일치도로 다시 매기면 "디올" 을 쳤을 때
 * 덜 알려진 향수가 위에 올 수 있는데, 이 목록의 순위는 화해 기준이라 그게 곧
 * 사람들이 찾는 순서입니다.
 */
export function filterMapPerfumes(
  perfumes: MapPerfume[],
  keyword: string,
): MapPerfume[] {
  const needle = squash(keyword)
  if (!needle) return []

  return perfumes
    .filter((perfume) =>
      [perfume.name, perfume.brand, perfume.nameEn, perfume.brandEn].some(
        (field) => squash(field).includes(needle),
      ),
    )
    .sort((a, b) => a.rank - b.rank)
    .slice(0, MAP_SEARCH_LIMIT)
}

/** 공백을 지우고 소문자로 — 견주기 전에 양쪽에 똑같이 겁니다 */
function squash(value: string) {
  return value.replace(/\s+/g, '').toLowerCase()
}
