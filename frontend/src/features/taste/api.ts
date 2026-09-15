import { http } from '@/shared/api/http'
import { isScentFamilyKey } from '@/shared/config/scentFamilies'

import type { ScentVector, ScentVectorsResponse, ScentWeights } from './types'

/**
 * 백엔드는 **0~1 로 저장된 좌표를 그대로** 줍니다(`x` 0~1, `y` 0~0.83056).
 * 화면은 `viewBox="0 0 100 100"` 이라 100배 해서 넘깁니다 — 지도 컴포넌트가 쓰는
 * 스케일과 같아야 같은 자리에 찍힙니다.
 *
 * 향 지도(`GET /map`)도 같은 0~1 스케일이라, 그쪽을 붙일 때 같은 변환이 필요합니다.
 */
const MAP_SCALE = 100

// 경로에 '/api/v1' 을 붙이지 않습니다 — http 의 baseURL 에 이미 있습니다

/**
 * 취향 테스트가 쓰는 향수 200개의 계열 벡터 (TST-03).
 *
 * 로그인이 필요 없습니다. 페이지도 없습니다 — 화면이 200개를 모두 받아 두고
 * 브라우저에서 코사인 유사도를 재기 때문입니다. 나눠 받으면 전부 모일 때까지
 * 매칭을 시작할 수 없어 왕복만 늘어납니다.
 *
 * 지도 조회(`GET /map`)와 다릅니다. 거기는 점을 찍고 이름을 띄우는 값이라 대표 계열
 * **하나**만 담지만, 여기는 아홉 계열의 비중이 **전부** 필요합니다.
 */
export async function getScentVectors(): Promise<ScentVector[]> {
  const { data } = await http.get<ScentVectorsResponse>('/map/scent-vectors')

  return data.perfumes.map((row) => ({
    perfumeId: row.perfumeId,
    x: row.x * MAP_SCALE,
    y: row.y * MAP_SCALE,
    rank: row.rank,
    families: toScentWeights(row.families),
  }))
}

/**
 * 계열 비중에서 **우리가 아는 계열만** 남깁니다.
 *
 * 키는 `scent_regions.code` 라서 열려 있습니다 — 행이 더해지면 여기 없는 값이 옵니다.
 * 그대로 들고 있으면 코사인 유사도가 사용자가 고를 수 없는 축까지 세게 되고, 고른
 * 계열이 같아도 결과가 달라집니다. 모르는 축은 빼는 편이 덜 틀립니다.
 */
function toScentWeights(families: Record<string, number>): ScentWeights {
  const weights: ScentWeights = {}

  for (const [key, weight] of Object.entries(families)) {
    if (isScentFamilyKey(key)) weights[key] = weight
  }

  return weights
}
