import type {
  ScentFamilyKey,
  ScentVector,
  ScentWeights,
  TasteMatch,
  TasteMatchMode,
} from './types'

/** 취향 테스트 매칭 (TST-03). 훅을 쓰지 않는 순수 함수만 둡니다 */

/**
 * 1순위 · 2순위 가중치. 균등(0.5/0.5)이면 코사인 유사도가 대칭이라 순서를 바꿔도 결과가
 * 같아 1·2순위 배지가 뜻을 잃습니다.
 * NOTE: 0.58 이 상한입니다 — 0.585 부터는 1순위 계열만 가진 향수가 두 계열을 다 가진
 * 향수를 이겨 희소 조합에서 정작 그 향수를 놓칩니다(`match.test.ts` 가 막습니다).
 */
export const PRIMARY_WEIGHT = 0.58
const SECONDARY_WEIGHT = 1 - PRIMARY_WEIGHT

/** 부동소수 비교 오차. 유사도 동점을 판정할 때 씁니다. */
const EPSILON = 1e-9

/** 고른 계열로 취향 벡터를 만듭니다. 코사인 유사도는 크기를 안 봐 합을 1 로 맞추지 않습니다. */
export function buildTasteVector(
  picks: readonly ScentFamilyKey[],
): ScentWeights {
  if (picks.length === 1) return { [picks[0]!]: 1 }
  if (picks.length === 2) {
    return { [picks[0]!]: PRIMARY_WEIGHT, [picks[1]!]: SECONDARY_WEIGHT }
  }
  return {}
}

/** 두 계열 벡터의 코사인 유사도(0~1). 방향만 봐 계열 사이의 비율이 비슷한 향수가 뽑힙니다. */
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

/** 고른 계열을 모두 가진 향수의 수. 희소 조합 목록을 적지 않고 세어 데이터가 바뀌어도 따라갑니다. */
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
  // 한 개만 골랐으면 "함께 담은 향수" 라는 말이 성립하지 않으므로 일반 문구를 씁니다.
  if (picks.length < 2) return 'NORMAL'
  if (candidateCount === 0) return 'NO_OVERLAP'
  if (candidateCount === 1) return 'RARE'
  return 'NORMAL'
}

/**
 * 출발점이 될 향수 한 개. 유사도가 가장 높은 향수, 동점이면 국내 선정 순위(`rank`) 입니다 —
 * 한 계열만 고르면 그 계열 단독 향수들의 유사도가 전부 1.0 이라 동점이 대량으로 생깁니다.
 */
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
  const { vector: best, similarity: bestSimilarity } = top

  const candidateCount = countCandidates(vectors, picks)

  return {
    picks: [...picks],
    perfumeId: best.perfumeId,
    x: best.x,
    y: best.y,
    similarity: bestSimilarity,
    mode: resolveMode(picks, candidateCount),
    candidateCount,
  }
}
