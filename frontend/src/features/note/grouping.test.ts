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

  it('섹션이 갈라져도 같은 알약을 두 번 만들지 않는다', () => {
    const 흐트러진순서 = [NOTES[0]!, NOTES[2]!, NOTES[1]!]

    expect(noteFamilies(흐트러진순서)).toEqual(['CITRUS', 'MUSK'])
  })
})

describe('filterByFamily', () => {
  it('고른 대분류만 남긴다', () => {
    expect(filterByFamily(NOTES, 'MUSK').map((n) => n.name)).toEqual(['Musk'])
  })

  it("'기타' 를 고르면 대분류가 비어 있는 노트가 걸린다", () => {
    expect(filterByFamily(NOTES, UNCATEGORIZED).map((n) => n.name)).toEqual([
      'Vetiver',
    ])
  })

  it('아무것도 안 골랐으면 그대로 돌려준다', () => {
    expect(filterByFamily(NOTES, null)).toBe(NOTES)
  })
})
