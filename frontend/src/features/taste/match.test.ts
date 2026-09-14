import { beforeAll, describe, expect, it } from 'vitest'

import { getScentVectors } from './api'
import {
  PRIMARY_WEIGHT,
  buildTasteVector,
  cosineSimilarity,
  countCandidates,
  matchStartingPoint,
} from './match'
import {
  SCENT_FAMILY_KEYS,
  type ScentFamilyKey,
  type ScentVector,
} from './types'

/**
 * 매칭 로직은 화면 없이 전부 검증합니다.
 *
 * 특히 아래 두 가지는 데이터가 갱신되면 조용히 깨지는 것들이라 전수로 확인합니다.
 * - 희소 조합(후보 1개)에서 정작 그 유일한 향수를 놓치지 않는가
 * - 유사도 동점일 때 결과가 배열 순서에 좌우되지 않는가
 */

let vectors: ScentVector[]

beforeAll(async () => {
  vectors = await getScentVectors()
})

/** 두 계열을 고르는 모든 순서쌍 (9 × 8 = 72가지) */
function orderedPairs(): [ScentFamilyKey, ScentFamilyKey][] {
  const pairs: [ScentFamilyKey, ScentFamilyKey][] = []
  for (const first of SCENT_FAMILY_KEYS) {
    for (const second of SCENT_FAMILY_KEYS) {
      if (first !== second) pairs.push([first, second])
    }
  }
  return pairs
}

describe('buildTasteVector', () => {
  it('하나만 고르면 그 계열만 담는다', () => {
    expect(buildTasteVector(['FLORAL'])).toEqual({ FLORAL: 1 })
  })

  it('두 개를 고르면 1순위에 더 큰 가중치를 준다', () => {
    const vector = buildTasteVector(['FLORAL', 'MUSK'])

    expect(vector.FLORAL).toBeGreaterThan(vector.MUSK ?? 0)
    expect(vector.FLORAL).toBe(PRIMARY_WEIGHT)
  })
})

describe('cosineSimilarity', () => {
  it('절대 강도가 아니라 계열 사이의 비율을 본다', () => {
    // 1순위 FLORAL · 2순위 MUSK 를 골랐을 때,
    // FLORAL 이 압도적인 향수보다 둘이 비슷하게 섞인 향수가 더 가깝습니다.
    const taste = buildTasteVector(['FLORAL', 'MUSK'])
    const balanced = cosineSimilarity(taste, { FLORAL: 0.52, MUSK: 0.48 })
    const lopsided = cosineSimilarity(taste, { FLORAL: 0.7, MUSK: 0.2 })

    expect(balanced).toBeGreaterThan(lopsided)
  })

  it('크기가 달라도 방향이 같으면 유사도가 같다', () => {
    const taste = buildTasteVector(['GREEN'])

    expect(cosineSimilarity(taste, { GREEN: 0.24 })).toBeCloseTo(
      cosineSimilarity(taste, { GREEN: 0.9 }),
      10,
    )
  })

  it('겹치는 계열이 없으면 0 이다', () => {
    expect(cosineSimilarity({ FLORAL: 1 }, { WOODY: 0.5 })).toBe(0)
  })
})

describe('matchStartingPoint', () => {
  it('아무것도 고르지 않으면 결과가 없다', () => {
    expect(matchStartingPoint(vectors, [])).toBeNull()
  })

  it('계열 하나로도 결과가 나오고 일반 문구를 쓴다', () => {
    for (const family of SCENT_FAMILY_KEYS) {
      const match = matchStartingPoint(vectors, [family])

      expect(match, `${family} 단독 선택에 결과가 없습니다`).not.toBeNull()
      expect(match?.mode).toBe('NORMAL')
      expect(
        vectors.find((vector) => vector.perfumeId === match?.perfumeId)
          ?.families[family],
      ).toBeDefined()
    }
  })

  it('두 계열을 고른 72가지 순서쌍 모두 결과가 나온다', () => {
    for (const picks of orderedPairs()) {
      const match = matchStartingPoint(vectors, picks)
      expect(match, `${picks.join('>')} 에 결과가 없습니다`).not.toBeNull()
    }
  })

  it('후보가 있는 조합에서는 두 계열을 모두 가진 향수가 뽑힌다', () => {
    // 1순위 가중치를 올리면 여기서부터 깨집니다. PRIMARY_WEIGHT 0.58 이 상한입니다.
    for (const picks of orderedPairs()) {
      const candidates = countCandidates(vectors, picks)
      if (candidates === 0) continue

      const match = matchStartingPoint(vectors, picks)
      const picked = vectors.find(
        (vector) => vector.perfumeId === match?.perfumeId,
      )

      expect(
        picks.every((pick) => picked?.families[pick] !== undefined),
        `${picks.join('>')} (후보 ${candidates}개) 에서 두 계열을 모두 가진 향수가 뽑히지 않았습니다`,
      ).toBe(true)
    }
  })

  it('두 계열을 다 가진 향수가 없으면 1순위 계열 향수가 뽑힌다', () => {
    for (const picks of orderedPairs()) {
      if (countCandidates(vectors, picks) !== 0) continue

      const match = matchStartingPoint(vectors, picks)
      const picked = vectors.find(
        (vector) => vector.perfumeId === match?.perfumeId,
      )

      expect(match?.mode).toBe('NO_OVERLAP')
      expect(picked?.families[picks[0]]).toBeDefined()
      expect(picked?.families[picks[1]]).toBeUndefined()
    }
  })

  it('고른 계열 수에 따라 모드가 정해진다', () => {
    for (const picks of orderedPairs()) {
      const candidates = countCandidates(vectors, picks)
      const match = matchStartingPoint(vectors, picks)
      // 기대값을 먼저 정하고 한 번만 단언합니다.
      // expect 를 if/else 안에 두면 분기가 안 타도 테스트가 통과해버립니다.
      const expected =
        candidates === 0 ? 'NO_OVERLAP' : candidates === 1 ? 'RARE' : 'NORMAL'

      expect(match?.mode, `${picks.join('>')} · 후보 ${candidates}개`).toBe(
        expected,
      )
    }
  })

  it('유사도가 같으면 국내 선정 순위가 앞선 향수를 쓴다', () => {
    // 플로럴 단독 향수들은 유사도가 전부 정확히 1.0 이라 동점이 대량으로 생깁니다.
    const match = matchStartingPoint(vectors, ['FLORAL'])
    const tied = vectors.filter(
      (vector) =>
        Math.abs(
          cosineSimilarity(buildTasteVector(['FLORAL']), vector.families) - 1,
        ) < 1e-9,
    )

    expect(tied.length).toBeGreaterThan(1)
    expect(match?.perfumeId).toBe(
      tied.reduce((best, vector) => (vector.rank < best.rank ? vector : best))
        .perfumeId,
    )
  })

  it('배열 순서를 바꿔도 결과가 같다', () => {
    const shuffled = [...vectors].reverse()

    for (const picks of orderedPairs()) {
      expect(
        matchStartingPoint(shuffled, picks)?.perfumeId,
        `${picks.join('>')} 의 결과가 데이터 순서에 좌우됩니다`,
      ).toBe(matchStartingPoint(vectors, picks)?.perfumeId)
    }
  })

  it('1순위와 2순위를 바꾸면 결과가 달라지는 조합이 있다', () => {
    const flipped = orderedPairs().filter(([first, second]) => {
      const forward = matchStartingPoint(vectors, [first, second])
      const backward = matchStartingPoint(vectors, [second, first])
      return forward?.perfumeId !== backward?.perfumeId
    })

    // 순서가 아무 데서도 결과를 바꾸지 않으면 1·2순위 배지가 거짓말이 됩니다.
    expect(flipped.length).toBeGreaterThan(0)
  })
})

describe('countCandidates', () => {
  it('두 계열을 모두 가진 향수만 센다', () => {
    const sample: ScentVector[] = [
      {
        perfumeId: 1,
        x: 0,
        y: 0,
        rank: 1,
        families: { FLORAL: 0.5, MUSK: 0.3 },
      },
      { perfumeId: 2, x: 0, y: 0, rank: 2, families: { FLORAL: 0.4 } },
      { perfumeId: 3, x: 0, y: 0, rank: 3, families: { MUSK: 0.4 } },
    ]

    expect(countCandidates(sample, ['FLORAL', 'MUSK'])).toBe(1)
    expect(countCandidates(sample, ['FLORAL'])).toBe(2)
    expect(countCandidates(sample, [])).toBe(0)
  })
})
