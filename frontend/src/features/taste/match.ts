import type {
  ScentFamilyKey,
  ScentVector,
  ScentWeights,
  TasteMatch,
  TasteMatchMode,
} from './types'

/**
 * 1순위 · 2순위 가중치. 균등(0.5/0.5)이면 코사인 유사도가 대칭이라 순서를 바꿔도 결과가
 * 같아 1·2순위 배지가 뜻을 잃습니다.
 * NOTE: 0.58 이 상한입니다 — 0.585 부터는 1순위 계열만 가진 향수가 두 계열을 다 가진
 * 향수를 이겨 희소 조합에서 정작 그 향수를 놓칩니다(`match.test.ts` 가 막습니다).
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

function resolveMode(
  picks: readonly ScentFamilyKey[],
  candidateCount: number,
): TasteMatchMode {
  if (picks.length < 2) return 'NORMAL'
  if (candidateCount === 0) return 'NO_OVERLAP'
  if (candidateCount === 1) return 'RARE'
  return 'NORMAL'
}

export function matchStartingPoint(
  vectors: readonly ScentVector[],
  picks: readonly ScentFamilyKey[],
): TasteMatch | null {
  if (picks.length === 0 || vectors.length === 0) return null

  const taste = buildTasteVector(picks)

  const scored = vectors
    .map((vector) => ({
      vector,
      similarity: cosineSimilarity(taste, vector.families),
    }))
    .filter((entry) => entry.similarity > 0)

  if (scored.length === 0) return null

  const [top] = scored.sort((a, b) => {
    const gap = b.similarity - a.similarity
    if (Math.abs(gap) > EPSILON) return gap
    return a.vector.rank - b.vector.rank
  })

  if (!top) return null
  const best = top.vector

  return {
    picks: [...picks],
    perfumeId: best.perfumeId,
    mode: resolveMode(picks, countCandidates(vectors, picks)),
  }
}
