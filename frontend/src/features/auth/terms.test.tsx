import { describe, expect, it } from 'vitest'

import { EMPTY_TERMS, hasAgreedRequired } from '@/features/auth/terms'

describe('hasAgreedRequired', () => {
  it('필수 항목이 하나라도 빠지면 false', () => {
    expect(hasAgreedRequired(EMPTY_TERMS)).toBe(false)
    expect(hasAgreedRequired({ ...EMPTY_TERMS, service: true })).toBe(false)
  })

  it('필수 항목을 모두 동의하면 선택 항목과 무관하게 true', () => {
    expect(
      hasAgreedRequired({ service: true, privacy: true, marketing: false }),
    ).toBe(true)
    expect(
      hasAgreedRequired({ service: true, privacy: true, marketing: true }),
    ).toBe(true)
  })
})
