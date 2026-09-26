import { describe, expect, it } from 'vitest'

import { opensElsewhere } from './opensElsewhere'

const press = (
  keys: Partial<
    Record<'metaKey' | 'ctrlKey' | 'shiftKey' | 'altKey', boolean>
  > = {},
) => ({
  metaKey: false,
  ctrlKey: false,
  shiftKey: false,
  altKey: false,
  ...keys,
})

describe('opensElsewhere', () => {
  it('맨 누름은 이 탭에서 여는 누름이다', () => {
    expect(opensElsewhere(press())).toBe(false)
  })

  it.each(['metaKey', 'ctrlKey', 'shiftKey', 'altKey'] as const)(
    '%s 를 쥐면 다른 곳에서 여는 누름이다',
    (key) => {
      expect(opensElsewhere(press({ [key]: true }))).toBe(true)
    },
  )
})
