import type {
  ScentFamilyKey,
  ScentVector,
  ScentWeights,
  TasteMatch,
  TasteMatchMode,
} from './types'

/**
 * 취향 테스트 매칭 (TST-03)
 *
 * 훅을 쓰지 않는 순수 함수만 둡니다. 렌더링 없이 테스트할 수 있고, 데이터가
 * 갱신됐을 때 `match.test.ts` 가 바로 잡아냅니다.
 */

/**
 * 1순위 · 2순위 가중치.
 *
 * 먼저 고른 계열에 더 큰 값을 줍니다. 균등(0.5/0.5)이면 코사인 유사도가 완전히
 * 대칭이라 순서를 바꿔도 결과가 같고, 화면의 1·2순위 배지가 아무 뜻도 갖지 못합니다.
 *
 * **0.58 이 상한입니다.** 시드 200개로 전수 검증한 결과:
 *   - 0.58 까지: 후보가 1개뿐인 희소 조합 8개에서 그 유일한 향수가 정확히 뽑히고,
 *     n ≥ 1 인 조합에서 동점이 생기지 않습니다. 23개 조합 중 17개에서 순서가
 *     결과를 바꿉니다.
 *   - 0.585 부터: 1순위 계열만 가진 향수가 두 계열을 다 가진 향수를 이기기 시작해,
 *     희소 조합인데 정작 그 향수를 놓칩니다.
 * 값을 올리려면 `match.test.ts` 의 희소 조합 검증을 먼저 통과시켜야 합니다.
 */
export const PRIMARY_WEIGHT = 0.58
export const SECONDARY_WEIGHT = 1 - PRIMARY_WEIGHT

/** 부동소수 비교 오차. 유사도 동점을 판정할 때 씁니다. */
const EPSILON = 1e-9

/**
 * 고른 계열로 취향 벡터를 만듭니다.
 *
 * 한 개면 그 계열만 1, 두 개면 1순위 0.58 · 2순위 0.42 입니다.
 * 코사인 유사도는 크기에 영향을 받지 않으므로 합을 1 로 맞출 필요가 없습니다.
 */
export function buildTasteVector(
  picks: readonly ScentFamilyKey[],
): ScentWeights {
  if (picks.length === 1) return { [picks[0]!]: 1 }
  if (picks.length === 2) {
    return { [picks[0]!]: PRIMARY_WEIGHT, [picks[1]!]: SECONDARY_WEIGHT }
  }
  return {}
}

/**
 * 두 계열 벡터의 코사인 유사도(0~1).
 *
 * 크기를 무시하고 방향만 보기 때문에, 비중의 절대값이 아니라 **계열 사이의 비율**이
 * 비슷한 향수가 뽑힙니다. 예를 들어 1순위 FLORAL · 2순위 MUSK 를 골랐을 때
 * FLORAL 0.7 / MUSK 0.2 인 향수보다 FLORAL 0.52 / MUSK 0.48 인 향수가 더 가깝습니다.
 */
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

/**
 * 고른 계열을 **모두** 가진 향수의 수.
 *
 * 희소 조합 목록을 코드에 적어두지 않고 여기서 세어 정합니다. 지도가 다시 만들어져
 * 데이터가 통째로 바뀌어도 판정이 함께 따라갑니다.
 */
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
 * 출발점이 될 향수 한 개를 고릅니다.
 *
 * 1. 취향 벡터와의 코사인 유사도가 가장 높은 향수
 * 2. 동점이면 국내 선정 순위(`rank`)가 앞선 향수
 *
 * 2번이 없으면 결과가 배열 순서에 좌우됩니다. 한 계열만 고른 경우 그 계열 하나만 가진
 * 향수들의 유사도가 **전부 정확히 1.0** 이라(예: 플로럴 단독 40개) 동점이 대량으로
 * 발생하기 때문입니다.
 *
 * 두 계열을 다 가진 향수가 없는 조합(n = 0)에서도 되돌리는 분기가 따로 없습니다.
 * 1순위 가중치가 더 크기 때문에 1순위 계열 향수가 저절로 1위로 올라옵니다.
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
