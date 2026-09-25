import { http } from '@/shared/api/http'
import { isScentFamilyKey } from '@/shared/config/scentFamilies'

import type {
  ScentFamilyKey,
  ScentVector,
  ScentVectorsResponse,
  ScentWeights,
  TasteTestRecord,
} from './types'

export async function getScentVectors(): Promise<ScentVector[]> {
  const { data } = await http.get<ScentVectorsResponse>('/map/scent-vectors')

  return data.perfumes.map((row) => ({
    perfumeId: row.perfumeId,
    rank: row.rank,
    families: toScentWeights(row.families),
  }))
}

function toScentWeights(families: Record<string, number>): ScentWeights {
  const weights: ScentWeights = {}

  for (const [key, weight] of Object.entries(families)) {
    if (isScentFamilyKey(key)) weights[key] = weight
  }

  return weights
}

export async function getMyTasteTest(): Promise<TasteTestRecord> {
  const { data } = await http.get<TasteTestRecord>('/users/me/taste-test')
  return data
}

/*
 * 취향 테스트를 마쳤다고 남깁니다 (TST-03). `picks` 는 순서가 순위입니다(1순위 0.58 · 2순위 0.42).
 * NOTE: 이미 마친 사람은 409 라, 부르는 쪽이 "이미 됨" 으로 받아 넘겨야 합니다.
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
