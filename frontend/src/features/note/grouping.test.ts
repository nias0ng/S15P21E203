import { describe, expect, it } from 'vitest'

import {
  filterByFamily,
  groupByAccordFamily,
  noteFamilies,
  UNCATEGORIZED,
} from './grouping'
import type { Note } from './types'

const note = (
  partial: Partial<Note> & Pick<Note, 'noteId' | 'name'>,
): Note => ({
  nameKo: null,
  accordFamily: 'CITRUS',
  imageUrl: null,
  popularityRank: null,
  ...partial,
})

/** 서버가 주는 순서 그대로입니다 — 대분류 순, 그 안에서 인기 순 */
const NOTES: Note[] = [
  note({ noteId: 1, name: 'Bergamot' }),
  note({ noteId: 2, name: 'Lemon' }),
  note({ noteId: 3, name: 'Musk', accordFamily: 'MUSK' }),
  note({ noteId: 4, name: 'Vetiver', accordFamily: null }),
]

describe('groupByAccordFamily', () => {
  it('대분류가 바뀌는 자리에서 끊는다', () => {
    expect(groupByAccordFamily(NOTES).map((s) => s.family)).toEqual([
      'CITRUS',
      'MUSK',
      UNCATEGORIZED,
    ])
  })

  /* 몰래 합치면 정렬이 깨진 것을 아무도 모르고 넘어갑니다 */
  it('같은 대분류가 떨어져 두 번 나오면 섹션도 둘로 둔다', () => {
    const 흐트러진순서 = [NOTES[0]!, NOTES[2]!, NOTES[1]!]

    expect(groupByAccordFamily(흐트러진순서).map((s) => s.family)).toEqual([
      'CITRUS',
      'MUSK',
      'CITRUS',
    ])
  })
})

describe('noteFamilies', () => {
  it('섹션과 같은 순서로 대분류를 뽑는다', () => {
    expect(noteFamilies(NOTES)).toEqual(['CITRUS', 'MUSK', UNCATEGORIZED])
  })

  /* 알약은 섹션과 달라야 합니다 — 똑같은 알약이 둘 서면 어느 쪽을 눌러야 할지 모릅니다 */
  it('섹션이 갈라져도 같은 알약을 두 번 만들지 않는다', () => {
    const 흐트러진순서 = [NOTES[0]!, NOTES[2]!, NOTES[1]!]

    expect(noteFamilies(흐트러진순서)).toEqual(['CITRUS', 'MUSK'])
  })
})

describe('filterByFamily', () => {
  it('고른 대분류만 남긴다', () => {
    expect(filterByFamily(NOTES, 'MUSK').map((n) => n.name)).toEqual(['Musk'])
  })

  /* 알약에 '기타' 가 서므로 눌렀을 때도 걸려야 합니다 — 화면과 같은 기준 */
  it("'기타' 를 고르면 대분류가 비어 있는 노트가 걸린다", () => {
    expect(filterByFamily(NOTES, UNCATEGORIZED).map((n) => n.name)).toEqual([
      'Vetiver',
    ])
  })

  it('아무것도 안 골랐으면 그대로 돌려준다', () => {
    expect(filterByFamily(NOTES, null)).toBe(NOTES)
  })
})
