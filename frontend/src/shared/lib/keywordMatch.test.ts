import { describe, expect, it } from 'vitest'

import { keywordMatcher } from './keywordMatch'

describe('keywordMatcher', () => {
  it('칸 하나라도 검색어를 품으면 걸린다', () => {
    const matches = keywordMatcher('샤넬')

    expect(matches('No.5', '샤넬')).toBe(true)
    expect(matches('No.5', '디올')).toBe(false)
  })

  it('대소문자를 가리지 않는다', () => {
    expect(keywordMatcher('WOOD')('Wood Sage', null)).toBe(true)
    expect(keywordMatcher('wood')('WOOD SAGE')).toBe(true)
  })

  it('검색어의 앞뒤 공백은 떼고 본다', () => {
    expect(keywordMatcher('  우디 ')('우디 앰버')).toBe(true)
  })

  it('검색어가 비었으면 모두 걸린다', () => {
    expect(keywordMatcher('')('아무 이름')).toBe(true)
    expect(keywordMatcher('   ')(null)).toBe(true)
  })

  it('빈 칸은 걸리지 않는 칸으로 본다', () => {
    expect(keywordMatcher('샤넬')(null, undefined)).toBe(false)
  })

  it('칸 안의 공백은 그대로 둔다 — 띄어 쓴 이름은 띄어 써야 걸린다', () => {
    expect(keywordMatcher('조말론')('조 말론')).toBe(false)
  })
})
