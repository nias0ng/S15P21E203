import { describe, expect, it } from 'vitest'

import { parseId } from './parseId'

describe('parseId', () => {
  it('양의 정수는 번호로 읽는다', () => {
    expect(parseId('1')).toBe(1)
    expect(parseId('42')).toBe(42)
  })

  it.each(['1.5', '0', '-3'])('%s 는 번호가 될 수 없다', (raw) => {
    expect(parseId(raw)).toBeNull()
  })

  it.each([' ', '', 'abc', '1e3x'])('"%s" 는 번호가 아니다', (raw) => {
    expect(parseId(raw)).toBeNull()
  })

  it('안전한 정수를 넘으면 번호로 보지 않는다', () => {
    expect(parseId('9007199254740993')).toBeNull()
  })

  it('값이 없으면 null', () => {
    expect(parseId(null)).toBeNull()
    expect(parseId(undefined)).toBeNull()
  })
})
