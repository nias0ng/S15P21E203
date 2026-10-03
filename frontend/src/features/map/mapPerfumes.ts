import { toScentFamilyKey } from '@/shared/config/scentFamilies'

import type { MapPerfume } from './types'

/**
 * 엔진 데이터는 **필요할 때 한 번만** 받습니다 (88KB).
 *
 * 3D 지도에 떠 있는 향수 200개 — 향해 일지가 이름을 3D 와 같은 표기로 채우는 데 씁니다
 * (`lib/mapPerfumeLookup`). 첫 화면 번들에 넣지 않습니다. `import()` 라 vite 가 따로 묶고,
 * 두 번째부터는 이 약속을 그대로 씁니다 — 모듈 캐시가 있어 실제로 두 번 받지는 않지만,
 * 변환(200개 map)까지 다시 하지 않으려고 약속 자체를 들고 있습니다.
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
      mx: perfume.mx,
      my: perfume.my,
    })),
  )

  return loading
}
