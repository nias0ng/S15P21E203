import { describe, expect, it } from 'vitest'

import {
  PRIMARY_WEIGHT,
  buildTasteVector,
  cosineSimilarity,
  countCandidates,
  matchBySimilarity,
  matchStartingPoint,
  primaryRegionCandidates,
} from './match'
import { SCENT_VECTORS_FIXTURE } from './match.fixture'
import { STARTING_RANKS, startingKey } from './startingPoints'
import {
  SCENT_FAMILY_KEYS,
  type ScentFamilyKey,
  type ScentVector,
} from './types'

const vectors: ScentVector[] = SCENT_VECTORS_FIXTURE

function orderedPairs(): [ScentFamilyKey, ScentFamilyKey][] {
  const pairs: [ScentFamilyKey, ScentFamilyKey][] = []
  for (const first of SCENT_FAMILY_KEYS) {
    for (const second of SCENT_FAMILY_KEYS) {
      if (first !== second) pairs.push([first, second])
    }
  }
  return pairs
}

function allPicks(): ScentFamilyKey[][] {
  return [...SCENT_FAMILY_KEYS.map((family) => [family]), ...orderedPairs()]
}

function pickedOf(
  perfumeId: number | undefined,
  from: readonly ScentVector[] = vectors,
): ScentVector | undefined {
  return from.find((vector) => vector.perfumeId === perfumeId)
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
      expect(pickedOf(match?.perfumeId)?.families[family]).toBeDefined()
    }
  })

  it('두 계열을 고른 72가지 순서쌍 모두 결과가 나온다', () => {
    for (const picks of orderedPairs()) {
      const match = matchStartingPoint(vectors, picks)
      expect(match, `${picks.join('>')} 에 결과가 없습니다`).not.toBeNull()
    }
  })

  it('표에는 81가지 조합이 하나씩만 있다', () => {
    const keys = allPicks().map(startingKey)

    expect(Object.keys(STARTING_RANKS).sort()).toEqual([...keys].sort())
  })

  it('81가지 조합 모두 표가 정한 병을 쓴다', () => {
    for (const picks of allPicks()) {
      const match = matchStartingPoint(vectors, picks)

      expect(
        pickedOf(match?.perfumeId)?.rank,
        `${picks.join('>')} 가 표의 병을 쓰지 않습니다 — 지도에 없거나 1순위 계열이 없는 병입니다`,
      ).toBe(STARTING_RANKS[startingKey(picks)])
    }
  })

  it('뽑힌 병에 2순위 계열이 없으면 1순위만 반영했다고 알린다', () => {
    for (const picks of orderedPairs()) {
      const match = matchStartingPoint(vectors, picks)
      const hasSecond =
        pickedOf(match?.perfumeId)?.families[picks[1]] !== undefined
      const expected = !hasSecond
        ? 'PRIMARY_ONLY'
        : countCandidates(vectors, picks) === 1
          ? 'RARE'
          : 'NORMAL'

      expect(match?.mode, `${picks.join('>')} 의 모드`).toBe(expected)
    }
  })

  it('두 계열을 다 가진 향수가 없으면 1순위 계열 향수가 뽑힌다', () => {
    for (const picks of orderedPairs()) {
      if (countCandidates(vectors, picks) !== 0) continue

      const match = matchStartingPoint(vectors, picks)

      expect(match?.mode).toBe('PRIMARY_ONLY')
      expect(pickedOf(match?.perfumeId)?.families[picks[0]]).toBeDefined()
    }
  })

  it('81가지 조합 모두 1순위 계열 구역 안에 그려진 병을 고른다', () => {
    for (const picks of allPicks()) {
      const match = matchStartingPoint(vectors, picks)

      expect(
        pickedOf(match?.perfumeId)?.labelRegion,
        `${picks.join('>')} 가 1순위 계열 구역 밖의 병을 골랐습니다`,
      ).toBe(picks[0])
    }
  })

  it('아홉 계열 모두 이름표 조각 안에 그 계열을 가진 병이 있다', () => {
    for (const family of SCENT_FAMILY_KEYS) {
      expect(
        primaryRegionCandidates(vectors, family).length,
        `${family} 구역 안에 고를 병이 없습니다`,
      ).toBeGreaterThan(0)
    }
  })

  it('표의 병이 지도에서 빠지면 1순위 계열 구역 안에서 유사도로 고른다', () => {
    const rest = vectors.filter(
      (vector) => vector.rank !== STARTING_RANKS[startingKey(['MUSK'])],
    )
    const match = matchStartingPoint(rest, ['MUSK'])

    // 구역을 보지 않으면 국내 1위가 뽑히는데, 그 병은 우디 구역에 그려져 있습니다
    expect(matchBySimilarity(rest, ['MUSK'])?.labelRegion).not.toBe('MUSK')
    expect(pickedOf(match?.perfumeId)?.labelRegion).toBe('MUSK')
    expect(match?.perfumeId).toBe(
      matchBySimilarity(primaryRegionCandidates(rest, 'MUSK'), ['MUSK'])
        ?.perfumeId,
    )
  })

  it('표의 병이 1순위 계열 구역 밖으로 옮겨졌으면 쓰지 않는다', () => {
    const pinnedRank = STARTING_RANKS[startingKey(['MUSK'])]
    const moved = vectors.map((vector) =>
      vector.rank === pinnedRank
        ? { ...vector, labelRegion: 'WOODY' as const }
        : vector,
    )
    const picked = pickedOf(
      matchStartingPoint(moved, ['MUSK'])?.perfumeId,
      moved,
    )

    expect(picked?.rank).not.toBe(pinnedRank)
    expect(picked?.labelRegion).toBe('MUSK')
  })

  it('표의 병이 1순위 계열을 잃었으면 쓰지 않는다', () => {
    const pinnedRank = STARTING_RANKS[startingKey(['MUSK'])]
    const changed = vectors.map((vector) =>
      vector.rank === pinnedRank
        ? { ...vector, families: { WOODY: 0.3 } }
        : vector,
    )
    const picked = pickedOf(
      matchStartingPoint(changed, ['MUSK'])?.perfumeId,
      changed,
    )

    expect(picked?.rank).not.toBe(pinnedRank)
    expect(picked?.labelRegion).toBe('MUSK')
  })

  it('1순위 계열 구역 안에 후보가 없으면 구역 밖에서 고르지 않고 결과가 없다', () => {
    const unlabeled = vectors.map((vector) => ({
      ...vector,
      labelRegion: null,
    }))

    expect(matchStartingPoint(unlabeled, ['MUSK'])).toBeNull()
    expect(matchStartingPoint(unlabeled, ['MUSK', 'WOODY'])).toBeNull()
  })
})

describe('matchBySimilarity', () => {
  it('후보가 있는 조합에서는 두 계열을 모두 가진 향수가 뽑힌다', () => {
    for (const picks of orderedPairs()) {
      const candidates = countCandidates(vectors, picks)
      if (candidates === 0) continue

      const picked = matchBySimilarity(vectors, picks)

      expect(
        picks.every((pick) => picked?.families[pick] !== undefined),
        `${picks.join('>')} (후보 ${candidates}개) 에서 두 계열을 모두 가진 향수가 뽑히지 않았습니다`,
      ).toBe(true)
    }
  })

  it('두 계열을 다 가진 향수가 없으면 1순위 계열 향수가 뽑힌다', () => {
    for (const picks of orderedPairs()) {
      if (countCandidates(vectors, picks) !== 0) continue

      const picked = matchBySimilarity(vectors, picks)

      expect(picked?.families[picks[0]]).toBeDefined()
      expect(picked?.families[picks[1]]).toBeUndefined()
    }
  })

  it('유사도가 같으면 국내 선정 순위가 앞선 향수를 쓴다', () => {
    const tied = vectors.filter(
      (vector) =>
        Math.abs(
          cosineSimilarity(buildTasteVector(['FLORAL']), vector.families) - 1,
        ) < 1e-9,
    )

    expect(tied.length).toBeGreaterThan(1)
    expect(matchBySimilarity(vectors, ['FLORAL'])?.perfumeId).toBe(
      tied.reduce((best, vector) => (vector.rank < best.rank ? vector : best))
        .perfumeId,
    )
  })

  it('배열 순서를 바꿔도 결과가 같다', () => {
    const shuffled = [...vectors].reverse()

    for (const picks of orderedPairs()) {
      expect(
        matchBySimilarity(shuffled, picks)?.perfumeId,
        `${picks.join('>')} 의 결과가 데이터 순서에 좌우됩니다`,
      ).toBe(matchBySimilarity(vectors, picks)?.perfumeId)
    }
  })

  it('1순위와 2순위를 바꾸면 결과가 달라지는 조합이 있다', () => {
    const flipped = orderedPairs().filter(([first, second]) => {
      const forward = matchBySimilarity(vectors, [first, second])
      const backward = matchBySimilarity(vectors, [second, first])
      return forward?.perfumeId !== backward?.perfumeId
    })

    expect(flipped.length).toBeGreaterThan(0)
  })
})

describe('countCandidates', () => {
  it('두 계열을 모두 가진 향수만 센다', () => {
    const sample: ScentVector[] = [
      {
        perfumeId: 1,
        rank: 1,
        families: { FLORAL: 0.5, MUSK: 0.3 },
        labelRegion: 'FLORAL',
      },
      {
        perfumeId: 2,
        rank: 2,
        families: { FLORAL: 0.4 },
        labelRegion: 'FLORAL',
      },
      { perfumeId: 3, rank: 3, families: { MUSK: 0.4 }, labelRegion: 'MUSK' },
    ]

    expect(countCandidates(sample, ['FLORAL', 'MUSK'])).toBe(1)
    expect(countCandidates(sample, ['FLORAL'])).toBe(2)
    expect(countCandidates(sample, [])).toBe(0)
  })
})
