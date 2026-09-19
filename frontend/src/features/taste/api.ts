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
 * 백엔드는 **0~1 좌표를 그대로** 줍니다(`x` 0~1, `y` 0~0.83056). 화면은
 * `viewBox="0 0 100 100"` 이라 100배 합니다. 향 지도(`GET /map`)도 같은 스케일입니다.
 */
const MAP_SCALE = 100

/**
 * 취향 테스트가 쓰는 향수 200개의 계열 벡터 (TST-03). 로그인도 페이지도 없습니다 —
 * 화면이 200개를 모두 받아 브라우저에서 코사인 유사도를 잽니다.
 *
 * 지도 조회(`GET /map`)는 대표 계열 **하나**만 담지만 여기는 아홉 계열의 비중이
 * **전부** 필요합니다.
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
 * 계열 비중에서 **우리가 아는 계열만** 남깁니다. 키는 `scent_regions.code` 라 열려
 * 있어, 그대로 두면 코사인 유사도가 사용자가 고를 수 없는 축까지 셉니다.
 */
function toScentWeights(families: Record<string, number>): ScentWeights {
  const weights: ScentWeights = {}

  for (const [key, weight] of Object.entries(families)) {
    if (isScentFamilyKey(key)) weights[key] = weight
  }

  return weights
}

/**
 * 내 취향 테스트 기록 (TST-03). 로그인이 필요합니다. 아직 안 치렀으면 `completed` 가
 * false 인 200 이라, 처음 온 사람을 오류로 다루지 않아도 됩니다.
 */
export async function getMyTasteTest(): Promise<TasteTestRecord> {
  const { data } = await http.get<TasteTestRecord>('/users/me/taste-test')
  return data
}

/**
 * 취향 테스트를 마쳤다고 남깁니다 (TST-03). 로그인이 필요합니다.
 *
 * `picks` 는 **순서가 순위**입니다(1순위 0.58 · 2순위 0.42). `matchedPerfumeId` 는
 * **화면이 고른 향수**이고, 서버는 지도에 있는지만 확인합니다 — 자바로 한 벌 더 두면
 * 두 결과가 갈릴 때 가릴 근거가 없습니다.
 *
 * **이미 마친 사람은 409 입니다** — 부르는 쪽이 "이미 됨" 으로 받아 넘겨야 합니다.
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
