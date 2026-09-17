import { http } from '@/shared/api/http'
import { isScentFamilyKey } from '@/shared/config/scentFamilies'

import type {
  ScentFamilyKey,
  ScentVector,
  ScentVectorsResponse,
  ScentWeights,
  TasteTestRecord,
} from './types'

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

/**
 * 내 취향 테스트 기록 (TST-03). 로그인이 필요합니다.
 *
 * **로그인 직후 온보딩을 띄울지 여기서 정합니다.** 아직 안 치렀으면 `completed` 가
 * false 인 200 이라, 처음 온 사람을 오류로 다루지 않아도 됩니다.
 */
export async function getMyTasteTest(): Promise<TasteTestRecord> {
  const { data } = await http.get<TasteTestRecord>('/users/me/taste-test')
  return data
}

/**
 * 취향 테스트를 마쳤다고 남깁니다 (TST-03). 로그인이 필요합니다.
 *
 * `picks` 는 **순서가 순위**입니다. 첫 번째가 1순위이고, 뒤집으면 서버에 다른 취향으로
 * 남습니다(1순위 0.58 · 2순위 0.42).
 *
 * `matchedPerfumeId` 는 **화면이 고른 향수**입니다. 서버는 다시 계산하지 않고 그 향수가
 * 지도에 있는지만 확인합니다 — 코사인 유사도가 이미 화면에 있고 테스트도 거기 붙어 있어서,
 * 자바로 한 벌 더 두면 두 결과가 갈릴 때 어느 쪽이 맞는지 가릴 근거가 없습니다.
 *
 * **이미 마친 사람은 409 입니다.** 한 번만 치릅니다 — 호출하는 쪽이 그 상태를 "이미 됨"
 * 으로 받아 넘겨야 합니다.
 */
export async function completeTasteTest(input: {
  picks: readonly ScentFamilyKey[]
  matchedPerfumeId: number
}): Promise<TasteTestRecord> {
  const { data } = await http.post<TasteTestRecord>('/users/me/taste-test', {
    picks: input.picks,
    matchedPerfumeId: input.matchedPerfumeId,
  })
  return data
}
