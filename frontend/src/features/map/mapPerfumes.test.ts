import { describe, expect, it } from 'vitest'

import { filterMapPerfumes } from './mapPerfumes'
import type { MapPerfume } from './types'

const perfume = (overrides: Partial<MapPerfume>): MapPerfume => ({
  fragranticaId: 1,
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

const ORPHEON = perfume({
  fragranticaId: 10,
  name: '오르페옹',
  brand: '딥티크',
  nameEn: 'Orpheon',
  brandEn: 'Diptyque',
  rank: 30,
})
const ARI = perfume({
  fragranticaId: 20,
  name: '아리',
  brand: '아리아나 그란데',
  nameEn: 'Ari',
  brandEn: 'Ariana Grande',
  rank: 27,
})

describe('filterMapPerfumes', () => {
  it('한 칸에 든 말은 전처럼 찾는다', () => {
    expect(filterMapPerfumes([ORPHEON, ARI], '딥티크')).toEqual([ORPHEON])
    expect(filterMapPerfumes([ORPHEON, ARI], 'ariana grande')).toEqual([ARI])
  })

  // 브랜드와 이름을 같이 치면 어느 한 칸에도 그 말 전체가 없어 200개가 전부 빠졌습니다
  it('브랜드와 이름을 같이 쳐도 찾는다', () => {
    expect(filterMapPerfumes([ORPHEON, ARI], '딥티크 오르페옹')).toEqual([
      ORPHEON,
    ])
    expect(filterMapPerfumes([ORPHEON, ARI], '딥티크오르페옹')).toEqual([
      ORPHEON,
    ])
    expect(filterMapPerfumes([ORPHEON, ARI], 'Diptyque Orpheon')).toEqual([
      ORPHEON,
    ])
  })

  it('찾는 말투는 빼고 이름 낱말로 찾는다', () => {
    expect(filterMapPerfumes([ORPHEON, ARI], '오르페옹과 비슷한 향수')).toEqual(
      [ORPHEON],
    )
  })

  it('낱말 하나라도 없으면 걸리지 않는다', () => {
    expect(filterMapPerfumes([ORPHEON, ARI], '딥티크 도손')).toEqual([])
  })

  it('찾는 말투만 있으면 아무것도 안 건다', () => {
    expect(filterMapPerfumes([ORPHEON, ARI], '비슷한 향수')).toEqual([])
  })
})
