import { describe, expect, it } from 'vitest'

import { PERFUMES } from '@landing/perfumes-data'

import { loadMapPerfumes } from '../mapPerfumes'
import type { MapPerfume, VoyageLogEntry } from '../types'

import { buildMapPerfumeLookup, withMapPerfumes } from './mapPerfumeLookup'
import { buildPerfumeIdIndex } from './perfumeIdAt'

const perfume = (overrides: Partial<MapPerfume>): MapPerfume => ({
  fragranticaId: 0,
  name: '',
  label: '',
  brand: '',
  nameEn: '',
  brandEn: '',
  family: null,
  rank: 1,
  mx: 0,
  my: 0,
  ...overrides,
})

const MISS_DIOR = perfume({
  name: '미스 디올 오 드 퍼퓸 (2021)',
  label: '미스 디올',
  brand: '디올',
  family: 'FLORAL',
  mx: 0.75,
  my: 0.125,
})

describe('buildMapPerfumeLookup', () => {
  const index = buildPerfumeIdIndex([
    { perfumeId: 11, x: 0.75, y: 0.125 },
    { perfumeId: 28, x: 0.25, y: 0.5 },
  ])

  it('좌표로 DB 향수 번호를 찾아 지도 향수를 잇는다', () => {
    const lookup = buildMapPerfumeLookup(index, [MISS_DIOR])

    expect(lookup.get(11)).toBe(MISS_DIOR)
    expect(lookup.has(28)).toBe(false)
  })

  it('DB 에서 못 찾은 향수는 담지 않는다', () => {
    const lookup = buildMapPerfumeLookup(index, [perfume({ mx: 0.9, my: 0.9 })])

    expect(lookup.size).toBe(0)
  })
})

describe('withMapPerfumes', () => {
  const entry: VoyageLogEntry = {
    entryId: 1,
    enteredAt: '2026-09-23T01:44:54Z',
    scentRegionId: 1,
    region: 'FLORAL',
    visited: [
      { perfumeId: 11, name: 'Miss Dior Eau de Parfum (2021)' },
      { perfumeId: 999, name: 'Unknown Perfume' },
    ],
  }

  it('찾은 향수는 짧은 한글 이름 · 전체 이름 · 브랜드 · 계열로 채우고, 못 찾은 향수는 그대로 둔다', () => {
    const [filled] = withMapPerfumes([entry], new Map([[11, MISS_DIOR]]))

    expect(filled?.visited).toEqual([
      {
        perfumeId: 11,
        name: '미스 디올',
        fullName: '미스 디올 오 드 퍼퓸 (2021)',
        brand: '디올',
        family: 'FLORAL',
      },
      { perfumeId: 999, name: 'Unknown Perfume' },
    ])
    // 받은 줄은 건드리지 않는다 — 쿼리 캐시의 값이다
    expect(entry.visited[0]?.name).toBe('Miss Dior Eau de Parfum (2021)')
  })
})

/**
 * 실제 엔진 데이터로 잽니다 — `GET /api/v1/map` 의 좌표는 엔진과 **같은 CSV** 에서 나오므로
 * (`perfumeIdAt.test.ts` 의 전제), 그 좌표에 번호를 매겨 두면 200개가 모두 찾혀야 합니다.
 */
describe('지도 향수 200개', () => {
  it('200개 모두 좌표로 찾히고, 제 한글 이름 · 짧은 이름을 갖는다', async () => {
    const perfumes = await loadMapPerfumes()
    const index = buildPerfumeIdIndex(
      PERFUMES.map((p, i) => ({ perfumeId: i + 1, x: p.mx, y: p.my })),
    )

    const lookup = buildMapPerfumeLookup(index, perfumes)

    expect(lookup.size).toBe(PERFUMES.length)
    const mismatched = PERFUMES.filter((p, i) => {
      const found = lookup.get(i + 1)
      return found?.name !== p.nameKo || found.label !== p.labelKo
    }).map((p) => p.name)
    expect(mismatched).toEqual([])
  })
})
