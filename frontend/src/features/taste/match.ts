import { STARTING_RANKS, startingKey } from './startingPoints'
import type {
  ScentFamilyKey,
  ScentVector,
  ScentWeights,
  TasteMatch,
  TasteMatchMode,
} from './types'

/**
 * 1순위 · 2순위 가중치. 균등(0.5/0.5)이면 코사인 유사도가 대칭이라 순서를 바꿔도 결과가 같아 1·2순위 배지가 뜻을 잃습니다.
 * NOTE: 0.58 이 상한입니다
 * — 0.585 부터는 1순위 계열만 가진 향수가 두 계열을 다 가진 향수를 이겨 희소 조합에서 정작 그 향수를 놓칩니다(`match.test.ts` 가 막습니다).
 */
export const PRIMARY_WEIGHT = 0.58
const SECONDARY_WEIGHT = 1 - PRIMARY_WEIGHT

const EPSILON = 1e-9

export function buildTasteVector(
  picks: readonly ScentFamilyKey[],
): ScentWeights {
  if (picks.length === 1) return { [picks[0]!]: 1 }
  if (picks.length === 2) {
    return { [picks[0]!]: PRIMARY_WEIGHT, [picks[1]!]: SECONDARY_WEIGHT }
  }
  return {}
}

export function cosineSimilarity(a: ScentWeights, b: ScentWeights): number {
  let dot = 0
  let normA = 0
  let normB = 0

  for (const value of Object.values(a)) normA += value * value
  for (const value of Object.values(b)) normB += value * value

  for (const [key, value] of Object.entries(a)) {
    const other = b[key as ScentFamilyKey]
    if (other !== undefined) dot += value * other
  }

  if (normA === 0 || normB === 0) return 0
  return dot / (Math.sqrt(normA) * Math.sqrt(normB))
}

export function countCandidates(
  vectors: readonly ScentVector[],
  picks: readonly ScentFamilyKey[],
): number {
  if (picks.length === 0) return 0
  return vectors.filter((vector) =>
    picks.every((pick) => vector.families[pick] !== undefined),
  ).length
}

/**
 * 결과 모달의 문구를 가릅니다. 표가 2순위 계열이 없는 병을 고를 수 있어, 후보 수가 아니라 뽑힌 병을 봅니다.
 */
function resolveMode(
  vectors: readonly ScentVector[],
  picks: readonly ScentFamilyKey[],
  best: ScentVector,
): TasteMatchMode {
  const [, second] = picks
  if (second === undefined) return 'NORMAL'
  if (best.families[second] === undefined) return 'PRIMARY_ONLY'
  return countCandidates(vectors, picks) === 1 ? 'RARE' : 'NORMAL'
}

/**
 * 출발점 후보 — 1순위 계열의 **이름표 조각 안에 그려진** 병 가운데 그 계열을 가진 병입니다.
 * 향 구성이 닮았어도 지도에서 다른 구역에 그려진 병이면 고른 계열에서 시작한 것으로 보이지 않습니다.
 * NOTE: 서버가 저장할 때 같은 조건을 다시 봅니다 — 밖이면 400 `TASTE_PERFUME_OUTSIDE_PRIMARY_REGION`
 */
export function primaryRegionCandidates(
  vectors: readonly ScentVector[],
  first: ScentFamilyKey,
): ScentVector[] {
  return vectors.filter(
    (vector) =>
      vector.labelRegion === first && vector.families[first] !== undefined,
  )
}

/**
 * 표(`STARTING_RANKS`)가 가리키는 병입니다. 후보 안에 있을 때만 씁니다.
 * 지도를 다시 만들어 그 병이 빠졌거나, 구역 밖으로 옮겨졌거나, 1순위 계열을 잃었으면 쓰지 않습니다.
 */
function pinnedStart(
  candidates: readonly ScentVector[],
  picks: readonly ScentFamilyKey[],
): ScentVector | undefined {
  const rank = STARTING_RANKS[startingKey(picks)]
  if (rank === undefined) return undefined

  return candidates.find((vector) => vector.rank === rank)
}

/**
 * 고른 계열과 향 구성이 가장 비슷한 병입니다. 유사도가 같으면 국내 선정 순위가 앞선 병입니다.
 * NOTE: 구역을 보지 않습니다 — 출발점을 고를 때는 후보를 1순위 계열 구역 안으로 줄여 넘깁니다.
 *
 * @returns 겹치는 계열이 있는 병이 하나도 없으면 null
 */
export function matchBySimilarity(
  vectors: readonly ScentVector[],
  picks: readonly ScentFamilyKey[],
): ScentVector | null {
  if (picks.length === 0) return null

  const taste = buildTasteVector(picks)

  const [top] = vectors
    .map((vector) => ({
      vector,
      similarity: cosineSimilarity(taste, vector.families),
    }))
    .filter((entry) => entry.similarity > 0)
    .sort((a, b) => {
      const gap = b.similarity - a.similarity
      if (Math.abs(gap) > EPSILON) return gap
      return a.vector.rank - b.vector.rank
    })

  return top?.vector ?? null
}

/**
 * 배를 처음 내릴 향수를 고릅니다. **언제나 1순위 계열 구역 안에서** 고릅니다 — 고른 계열마다 정해 둔
 * 표를 먼저 쓰고, 못 쓰면 구역 안에서 유사도로 고릅니다.
 *
 * @param vectors 향 지도의 향수 200병 (`GET /map/scent-vectors`)
 * @param picks 고른 계열. 순서가 순위입니다
 * @returns 결과 향수와 모달 문구의 갈래. 고른 것이 없거나 1순위 계열 구역 안에 후보가 없으면 null
 */
export function matchStartingPoint(
  vectors: readonly ScentVector[],
  picks: readonly ScentFamilyKey[],
): TasteMatch | null {
  const [first] = picks
  if (first === undefined) return null

  const candidates = primaryRegionCandidates(vectors, first)
  const best =
    pinnedStart(candidates, picks) ?? matchBySimilarity(candidates, picks)
  if (!best) return null

  return {
    picks: [...picks],
    perfumeId: best.perfumeId,
    mode: resolveMode(vectors, picks, best),
  }
}
